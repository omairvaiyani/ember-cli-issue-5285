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
        {value: 'title', label: "Title A-Z", reverse: false},
        {value: '-createdAt', label: "Newest first", reverse: true},
        {value: 'createdAt', label: "Oldest first", reverse: false},
        {value: 'memoryStrength', label: "Memory (Low - High)", reverse: false},
        {value: '-memoryStrength', label: "Memory (High - Low)", reverse: true}
    ],

    /**
     * @Property
     * The selected sorting method, e.g. by
     * title vs. createdAt etc.
     */
    myTestsListOrder: function () {
        if(localStorage.myTestsListOrder)
            return _.where(this.get('myTestsListOrders'),
                {value: localStorage.getObject('myTestsListOrder').value})[0];
        else
            return this.get('myTestsListOrders')[0];
    }.property(),

    /**
     * @Property
     * Stores the list order on the client browser
     * If set, it will be set by init on next load.
     */
    storeMyTestsListOrderLocally: function () {
        localStorage.setObject('myTestsListOrder',this.get('myTestsListOrder'));
    }.observes('myTestsListOrder'),

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
        'currentUser.myTests.@each.memoryStrength', 'activeTags.length', 'activeCategories.length'),

    /**
     * @Property Active Tags
     * Used to filter tests on page by tag.
     */
    activeTags: [],

    /**
     * @Property Active Categories
     * Used to filter tests on page by category.
     */
    activeCategories: [],

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
        },

        toggleCategoryFilter: function (object) {
            var category = object.get('content') ? object.get('content') : object;
            if (!category)
                return;

            if (_.contains(this.get('activeCategories'), category)) {
                this.get('activeCategories').removeObject(category);
            } else {
                this.get('activeCategories').pushObject(category);
            }
            category.set('isActive', _.contains(this.get('activeCategories'), category));
        }
    }
});
