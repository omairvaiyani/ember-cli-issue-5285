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

export default
Ember.Controller.extend(CurrentUser, {
    initialized: false,

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
        if (!this.get('currentUser') || !this.get('currentUser.following.length'))
            return;
        this.get('followingActions').clear();
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
        changeHomeNavigation: function (navigation) {
            this.set('homeIsActivities', false);
            this.set('homeIsTests', false);
            this.set('homeIsAttempts', false);

            switch(navigation) {
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
        }
    }
});
