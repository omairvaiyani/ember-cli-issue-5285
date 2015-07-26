import Ember from 'ember';
import CurrentUser from '../mixins/current-user';

export default Ember.Controller.extend(CurrentUser, {
    /*
     * GUEST MODE
     */

    /*
     * HOME MODE
     */
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
     * For the User to order the tests
     * on the my tests list by the select
     * drop down list.
     */
    myTestsListOrders: [
        {value: 'title', label: "Alphabetical", reverse: false},
        {value: 'createdAt', label: "Date Created", reverse: true},
        {value: 'memoryStrength', label: "Memory", reverse: true}
    ],
    /**
     * @Property
     * The selected sorting method, e.g. by
     * title vs. createdAt etc.
     */
    myTestsListOrder: function () {
        return this.get('myTestsListOrders')[2];
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

        // Tag filter, is separate from implicit filters
        if (this.get('activeTags.length')) {
            var activeTags = this.get('activeTags');
            finalList = finalList.filter(function (test) {
                var tagFound = false;
                _.each(test.get('tags'), function (tag) {
                    if (!tagFound && _.contains(activeTags, tag))
                        tagFound = true;
                });
                return tagFound;
            });
        }

        // The finalList var allows us to filter
        // this list only if needed, separating concerns.
        if (this.get('myTestsListFilter.length')) {
            var regex = new RegExp(this.get('myTestsListFilter').trim().toLowerCase(), 'gi'),
                finalList = finalList.filter(function (test) {
                    return test.get('title').toLowerCase().match(regex)
                        || (test.get('description.length') && test.get('description').toLowerCase().match(regex));
                });
        }

        var sortedOrderedAndFilteredList = finalList.sortBy(this.get('myTestsListOrder.value'));
        if (this.get('myTestsListOrder.reverse'))
            sortedOrderedAndFilteredList = sortedOrderedAndFilteredList.reverse();
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
    }.observes('currentUser.myTests.length', 'myTestsListType', 'myTestsListOrder', 'myTestsListFilter.length',
        'currentUser.myTests.@each.title.length', 'currentUser.myTests.@each.createdAt',
        'currentUser.myTests.@each.memoryStrength', 'activeTags.length'),

    /**
     * @Property Active Tag
     * Used to filter tests on page by tag.
     */
    activeTags: [],

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
        toggleTagFilter: function (tag) {
            if (!tag)
                return;

            if (_.contains(this.get('activeTags'), tag))
                this.get('activeTags').removeObject(tag);
            else
                this.get('activeTags').pushObject(tag);
        }
    }
});
