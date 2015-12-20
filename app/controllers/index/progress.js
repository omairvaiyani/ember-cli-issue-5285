import Ember from 'ember';
import ProgressCharts from '../../mixins/progress-charts';
import CurrentUser from '../../mixins/current-user';
import ParseHelper from '../../utils/parse-helper';

export default Ember.Controller.extend(CurrentUser, ProgressCharts, {
    /**
     * @Function Fetch Recent Attempts
     *
     * Only called on init, the first time.
     */
    fetchRecentAttempts: function () {
        var user = this.get('currentUser');
        if (user.get('testAttempts.length'))
            return console.log("Test attempts already fetched for user.");

        ParseHelper.cloudFunction(this, 'loadRecentAttemptsForUser', {}).then(function (result) {
            // Load minified author data before attempts
            ParseHelper.extractRawPayload(this.store, 'parse-user', result.authors);
            // Attempts include test
            var recentAttempts = ParseHelper.extractRawPayload(this.store, 'attempt', result.recentAttempts);
            user.get('testAttempts').addObjects(recentAttempts);
        }.bind(this), function (error) {
            console.dir(error);
        });
    }.on('init'),

    checkToCreateOrDestroyProgressChart: function () {
        // TODO replace this observer with index.progress route willDestroy hook
        var onProgressTab = this.get('applicationController.currentPath') === "index.progress";

        if (!onProgressTab)
            this.send('closeChart');
        else {
            setTimeout(function () {
                this.send('createChart');
            }.bind(this), 500);
        }
    }.observes('applicationController.currentPath.length'),

    /**
     * @Property
     */
    myProgressListTypes: [
        {value: 'testAttempts', label: "All Tests"},
        {value: 'srCompletedAttempts', label: "Spaced Repetition"}
    ],
    /**
     * @Property
     */
    myProgressListType: function () {
        return this.get('myProgressListTypes')[0];
    }.property(),

    /**
     * @Property
     * A single property to be used by the template
     * for displaying myProgress. It will  contain
     * either normal attempts, SR attempts or both.
     * This list is also ordered.
     */
    myProgressList: new Ember.A(),

    /**
     * @Function
     * Called by the throttling function,
     * this updates the myProgressList property.
     * The correct list of attempts are taken
     * from the currentUser and ordered as
     * set.
     */
    myProgressListUpdate: function () {
        var myProgressList = this.get('currentUser.' + this.get('myProgressListType.value')),
            finalList = new Ember.A();
        if (!this.get('currentUser'))
            return this.get('myProgressList').clear();
        finalList.addObjects(myProgressList);

        // Tag filter
        if (this.get('activeTags.length')) {
            var activeTags = this.get('activeTags');
            finalList = finalList.filter(function (attempt) {
                var matches = 0;
                _.each(attempt.get('test.tags'), function (tag) {
                    if (_.contains(activeTags, tag))
                        matches++;
                });
                return matches === activeTags.get('length');
            });
        }


        // Category filter
        if (this.get('activeCategories.length')) {
            var activeCategories = this.get('activeCategories');
            finalList = finalList.filter(function (attempt) {
                return this.get('activeCategories').contains(attempt.get('test.category.content')) ||
                    this.get('activeCategories').contains(attempt.get('test.category.parent.content'));
            }.bind(this));
        }

        // The finalList var allows us to filter
        // this list only if needed, separating concerns.
        if (this.get('myProgressListFilter.length')) {
            var regex = new RegExp(this.get('myProgressListFilter').trim().toLowerCase(), 'gi');
            finalList = finalList.filter(function (attempt) {
                return attempt.get('test.title').toLowerCase().match(regex)
                    || (attempt.get('test.description.length') && attempt.get('test.description').toLowerCase().match(regex));
            });
        }

        this.get('myProgressList').clear();
        this.get('myProgressList').addObjects(finalList.sortBy('createdAt').reverse());
    },

    /**
     * @Throttle
     * Throttles the myProgressList from updating
     * multiple times as createdTests and savedTests
     * are added/removed in quick succession.
     */
    myProgressListThrottle: function () {
        Ember.run.debounce(this, this.myProgressListUpdate, 50);
    }.observes('currentUser.testAttempts.length', 'myProgressListType', 'listOrder', 'myProgressListFilter.length',
        'currentUser.myTests.@each.title.length', 'currentUser.testAttempts.@each.createdAt',
        'activeTags.length', 'activeCategories.length'),

    actions: {
        fetchMemoryStrengthDataForTest: function (test) {
            // TODO
        }
    }

});
