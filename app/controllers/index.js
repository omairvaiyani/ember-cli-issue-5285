import
Ember
from
'ember';

import
CurrentUser
from
'../mixins/current-user';

import
ParseHelper
from
'../utils/parse-helper';

import
parallaxHandler
from
'../utils/parallax-handler';

export default
Ember.Controller.extend(CurrentUser, {
    needs: 'application',

    initialized: false,

    /*
     * GUEST MODE
     */
    /*
     * Activates on index.path if no currentUser (guest mode)
     */
    activateParallaxScrollListener: function () {
        var currentPath = this.get('controllers.application.currentPath');
        if(currentPath !== 'index' || this.get('currentUser'))
            return;

        setTimeout(
            function () {
                parallaxHandler('parallax-image', 'parallax-overlay-glass');
            }.bind(this), 500);
    }.observes('currentUser', 'controllers.application.currentPath'),

    stats: function () {
        if (this.get('currentUser'))
            return;

        var stats = {
            numberOfUsers: 0,
            numberOfTests: 0,
            numberOfQuestions: 0,
            numberOfAttempts: 0
        };
        var query = new Parse.Query('_User');
        query.count().then(function (count) {
                this.set('stats.numberOfUsers', count);
                query = new Parse.Query('Test');
                return query.count();
            }.bind(this)).then(function (count) {
                this.set('stats.numberOfTests', count);
                query = new Parse.Query('Question');
                return query.count();
            }.bind(this)).then(function (count) {
                this.set('stats.numberOfQuestions', count);
                query = new Parse.Query('Attempt');
                return query.count();
            }.bind(this)).then(function (count) {
                this.set('stats.numberOfAttempts', (count + 41007));
                return;
            }.bind(this));
        return stats;
    }.property('currentUser'),

    autocompleteTests: [],
    getAutocompleteTests: function () {
        var where = {
            tags: {
                "$all": ParseHelper.generateSearchTags(this.get('searchTermForTests'))
            }
        };
        this.store.findQuery('test', {where: JSON.stringify(where)})
            .then(function (tests) {
                this.get('autocompleteTests').clear();
                this.get('autocompleteTests').addObjects(tests);
            }.bind(this));
    }.observes('searchTermForTests.length'),

    /*
     * HOME MODE
     */

    homeIsActivities: true,

    homeIsTests: false,
    orderTests: 'title',

    homeIsAttempts: false,

    tests: [],

    testsAreOrderedByTitle: true,
    testsOrderedByTitle: function () {
        return this.get('currentUser.tests').sortBy('title');
    }.property('currentUser.tests.length'),

    testsAreOrderedByDate: false,
    testsOrderedByDate: function () {
        return this.get('currentUser.tests').sortBy('createdAt');
    }.property('currentUser.tests.length'),

    testsAreOrderedByCategory: false,
    testsOrderedByCategory: function () {
        if (!this.get('testsOrderedByTitle.length'))
            return;
        var tests = this.get('testsOrderedByTitle');
        var categoryNames = [],
            categoriesWithTests = [];
        tests.forEach(function (test) {
            var category = categoriesWithTests[categoryNames.indexOf(test.get('category.name'))];
            if (!category) {
                categoriesWithTests.push({name: test.get('category.name')});
                categoryNames.push(test.get('category.name'));
                category = categoriesWithTests[categoryNames.indexOf(test.get('category.name'))];
                category['tests'] = [];
            }
            category['tests'].push(test);
        }.bind(this));
        return categoriesWithTests.sortBy('name');
    }.property('testsOrderedByTitle.length'),


    readyToGetTests: false,
    getCurrentUsersTests: function () {
        if (!this.get('currentUser'))
            return;

        if (!this.get('currentUser.tests'))
            this.set('currentUser.tests', Em.A());

        var where = {
            'author': ParseHelper.generatePointer(this.get('currentUser'))
        };
        this.store.findQuery('test', {where: JSON.stringify(where), order: 'title', include: 'category'})
            .then(function (tests) {
                this.get('currentUser.tests').clear();
                this.get('currentUser.tests').addObjects(tests);
            }.bind(this));
    }.observes('initialized', 'currentUser.id'),

    followingActions: [],
    getFollowingActions: function () {
        this.get('followingActions').clear();

        if (!this.get('currentUser') || !this.get('currentUser.following.length')) {
            return;
        }

        var query = {
            user: {
                '$in': ParseHelper.generatePointers(this.get('currentUser.following'))
            },
            type: {"$nin": ["questionAnswered", "attemptStarted"]}
        };
        this.store.findQuery('action', {
            where: JSON.stringify(query),
            order: "-createdAt",
            limit: 15
        }).then(function (actions) {
                actions.forEach(function (action) {
                    switch (action.get('type')) {
                        case "joinedMyCQs":
                            action.set('title', " joined MyCQs!");
                            break;
                        case "testCreated":
                            action.set('title', " created a new test");
                            break;
                        case "attemptFinished":
                            action.set('title', " took a test");
                            break;
                    }
                }.bind(this));
                this.get('followingActions').addObjects(actions);
            }.bind(this));
    }.observes('initialized', 'currentUser.following.length'),

    actions: {
        /*
         * GUEST MODE
         */
        loadSearchedTest: function (test) {
            this.transitionToRoute('test', test.get('slug'));
        },
        searchTests: function () {
            this.transitionToRoute('category', "all", {queryParams: {search: this.get('searchTermForTests').toLowerCase()}});
        },
        /*
         * HOME MODE
         */
        changeHomeNavigation: function (navigation) {
            this.set('homeIsActivities', false);
            this.set('homeIsTests', false);
            this.set('homeIsAttempts', false);

            switch (navigation) {
                case 'activities':
                    this.set('homeIsActivities', true);
                    break;
                case 'tests':
                    this.set('homeIsTests', true);
                    break;
                case 'attempts':
                    this.set('homeIsAttempts', true);
                    break;
            }

        },

        changeOrderOfTests: function (orderTests) {
            this.set('orderTests', orderTests);
            this.set('testsAreOrderedByTitle', false);
            this.set('testsAreOrderedByDate', false);
            this.set('testsAreOrderedByCategory', false);
            switch (this.get('orderTests')) {
                case 'title':
                    this.set('testsAreOrderedByTitle', true);
                    break;
                case 'recent':
                    this.set('testsAreOrderedByDate', true);
                    break;
                case 'categorical':
                    this.set('testsAreOrderedByCategory', true);
                    break;
                default:
                    this.set('testsAreOrderedByTitle', true);
                    break;
            }
        }
    }
});
