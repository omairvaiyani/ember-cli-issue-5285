import Ember from 'ember';
import CurrentUser from '../mixins/current-user';
import TagsAndCats from '../mixins/tags-and-cats';
import SortBy from '../mixins/sort-by';
import EstimateMemoryStrength from '../mixins/estimate-memory-strength';
import DeleteWithUndo from '../mixins/delete-with-undo';
import ParseHelper from '../utils/parse-helper';


export default Ember.Controller.extend(CurrentUser, TagsAndCats, SortBy, EstimateMemoryStrength, DeleteWithUndo, {
    /*
     * GUEST MODE
     */

    /*
     * HOME MODE
     */
    // Needed by SortByMixin and TestCardComponent
    controllerId: "myTests",

    /**
     * @Property
     * For the User to select what tests
     * to include in the myTests list
     * by way of a radio button group.
     */
    myTestsListTypes: [
        {value: 'myTests', label: "All Tests"},
        {value: 'createdTests', label: "Tests I Made"},
        {value: 'savedTests', label: "Saved Tests"}
    ],
    /**
     * @Property
     * The selected list to display on my tests.
     * E.g. All Tests vs Created Tests vs. Saved
     */
    myTestsListType: function () {
        return this.get('myTestsListTypes')[0];
    }.property(),

    /**
     * @Property
     * The user can type in keywords to filter
     * the displayed myTestsList.
     */
    myTestsListFilter: '',

    /**
     * @Property
     * A single property to be used by the template
     * for displaying myTests. It will  contain
     * either createdTests, savedTests or both.
     * This list is also ordered.
     */
    myTestsList: new Ember.A(),

    /**
     * @Function
     * Called by the throttling function,
     * this updates the myTestsList property.
     * The correct list of tests are taken
     * from the currentUser and ordered as
     * set.
     */
    myTestsListUpdate: function () {
        var myTestsList = this.get('currentUser.' + this.get('myTestsListType.value')),
            finalList = new Ember.A();
        if (!this.get('currentUser'))
            return this.get('myTestsList').clear();
        finalList.addObjects(myTestsList);

        // Tag filter
        if (this.get('activeTags.length')) {
            var activeTags = this.get('activeTags');
            finalList = finalList.filter(function (test) {
                var matches = 0;
                _.each(test.get('tags'), function (tag) {
                    if (_.contains(activeTags, tag))
                        matches++;
                });
                return matches === activeTags.get('length');
            });
        }


        // Category filter
        if (this.get('activeCategories.length')) {
            var activeCategories = this.get('activeCategories');
            finalList = finalList.filter(function (test) {
                return this.get('activeCategories').contains(test.get('category.content')) ||
                    this.get('activeCategories').contains(test.get('category.parent.content'));
            }.bind(this));
        }

        // The finalList var allows us to filter
        // this list only if needed, separating concerns.
        if (this.get('myTestsListFilter.length')) {
            var regex = new RegExp(this.get('myTestsListFilter').trim().toLowerCase(), 'gi');
            finalList = finalList.filter(function (test) {
                return test.get('title').toLowerCase().match(regex)
                    || (test.get('description.length') && test.get('description').toLowerCase().match(regex));
            });
        }

        var sortedOrderedAndFilteredList = finalList.sortBy('title');

        // Secondary order of title, unless primary is title.
        // E.g. if order is by difficulty, matching tests will
        // then have been ordered by title.
        // TODO figure out how to avoid secondary order of title being reversed.
        if (this.get('listOrder.value') !== 'title')
            sortedOrderedAndFilteredList = sortedOrderedAndFilteredList
                .sortBy(this.get('listOrder.value'), 'title');

        if (this.get('listOrder.reverse'))
            sortedOrderedAndFilteredList = sortedOrderedAndFilteredList.reverseObjects();

        this.get('myTestsList').clear();
        this.get('myTestsList').addObjects(sortedOrderedAndFilteredList);
    },

    /**
     * @Throttle
     * Throttles the myTestsList from updating
     * multiple times as createdTests and savedTests
     * are added/removed in quick succession.
     */
    myTestsListThrottle: function () {
        Ember.run.debounce(this, this.myTestsListUpdate, 50);
    }.observes('currentUser.myTests.length', 'myTestsListType', 'listOrder', 'myTestsListFilter.length',
        'currentUser.myTests.@each.title.length', 'currentUser.myTests.@each.createdAt',
        'currentUser.myTests.@each.memoryStrength', 'activeTags.length', 'activeCategories.length'),

    actions: {
        /*
         * GUEST MODE
         */
        searchTests: function () {
            this.transitionToRoute('category', "all",
                {queryParams: {search: this.get('searchTermForTests').toLowerCase()}});
        },

        /*
         * USER MODE
         */
        deleteTest: function (test) {
          this.send('deleteObject', {array: this.get('currentUser.createdTests'), object: test,
          title: "Test deleted!", message: test.get('title')});
        },

        // Callback from DeleteWithUndoMixin
        preObjectDelete: function (returnItem) {
            if(returnItem.type === "test") {
                // If a user filtered to find a test to delete, clear the filter.
                if(this.get('myTestsList.length') === 1 && this.get('myTestsListFilter.length')) {
                    this.set('myTestsListFilter', "");
                }
            }
        },

        undoObjectDelete: function (returnItem, error) {
            // Called if object delete is undo'd,
            // TODO see if scrolling to test helps
        }

    }
});
