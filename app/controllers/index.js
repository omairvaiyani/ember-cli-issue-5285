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
    initialized: false,

    /*
     * GUEST MODE
     */
    parallaxScrollHandler: function () {
        console.log("init");
        var handler
        $(document).ready(function () {
            console.log("handler defined");
            var handler = parallaxHandler($('#parallax-image'), {speed: 0.30}, $('#parallax-overlay-glass'));
        }.bind(this));
    }.property('initialized'),

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
                this.set('stats.numberOfAttempts', count);
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
        return this.get('tests').sortBy('title');
    }.property('tests.length'),

    testsAreOrderedByDate: false,
    testsOrderedByDate: function () {
        return this.get('tests').sortBy('createdAt');
    }.property('tests.length'),

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

        var where = {
            'author': ParseHelper.generatePointer(this.get('currentUser'))
        };
        this.store.findQuery('test', {where: JSON.stringify(where), order: 'title', include: 'category'})
            .then(function (tests) {
                this.get('tests').clear();
                this.get('tests').addObjects(tests);
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
            this.set('testsAreOrderedByCategory', true);
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
        },

        toggleParallaxScrollListener: function (onIndex) {
            if (onIndex && !this.get('currentUser')) {
                $(document).ready(function () {
                    $(document).off("scroll", this.get('parallaxScrollHandler'));
                    if(this.get('parallaxScrollHandler'))
                        $(document).scroll(this.get('parallaxScrollHandler'));
                }.bind(this));
            } else {
                $(document).ready(function () {
                    if (this.get('parallaxScrollHandler'))
                        $(document).off("scroll", this.get('parallaxScrollHandler'));
                }.bind(this));
            }
        }
    }
});
