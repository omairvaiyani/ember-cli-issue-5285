import Ember from 'ember';
import CurrentUser from '../mixins/current-user';
import ParseHelper from '../utils/parse-helper';
import parallaxHandler from '../utils/parallax-handler';

export default Ember.Controller.extend(CurrentUser, {
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
        if (currentPath !== 'index' || this.get('currentUser'))
            return;

        setTimeout(
            function () {
                parallaxHandler('parallax-image', 'parallax-overlay-glass');
            }.bind(this), 500);
    }.observes('currentUser', 'controllers.application.currentPath'),

    stats: {
        numberOfUsers: '...',
        numberOfTests: '...',
        numberOfQuestions: '...',
        numberOfAttempts: '...'
    },

    getStats: function () {
        var currentPath = this.get('controllers.application.currentPath');
        if (currentPath !== 'index' || this.get('currentUser'))
            return;
        this.store.find('count').then(function (results) {
            results.forEach(function (count) {
                switch (count.get('type')) {
                    case "users":
                        this.set('stats.numberOfUsers', numeral(count.get('total')).format('0.0a'));
                        break;
                    case "tests":
                        this.set('stats.numberOfTests', numeral(count.get('total')).format('0.0a'));
                        break;
                    case "questions":
                        this.set('stats.numberOfQuestions', numeral(count.get('total')).format('0.0a'));
                        break;
                    case "attempts":
                        this.set('stats.numberOfAttempts', numeral(count.get('total') + 41000).format('0.0a'));
                        break;
                }
            }.bind(this));
        }.bind(this));

    }.observes('currentUser', 'controllers.application.currentPath'),

    /*
     * HOME MODE
     */

    homeIsActivities: true,

    homeIsTests: false,
    orderTests: 'title',

    homeIsAttempts: false,

    homeIsGroups: false,

    tests: [],

    myTests: function () {
        return new Ember.A();
    }.property(),

    testsAreOrderedByTitle: true,
    testsOrderedByTitle: function () {
        if (!this.get('currentUser.tests'))
            return [];
        this.get('myTests').clear();
        this.get('myTests').addObjects(this.get('currentUser.tests')).sortBy('title');
        return this.get('currentUser.tests').sortBy('title');
    }.property('currentUser.tests.length'),

    testsAreOrderedByDate: false,
    testsOrderedByDate: function () {
        if (!this.get('currentUser.tests'))
            return [];
        return Em.ArrayProxy.createWithMixins(Em.SortableMixin, {
            content: this.get('currentUser.tests'),
            sortProperties: ['createdAt'],
            sortAscending: false
        });
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


    // Deprecated: Get activities in ApplicationController
    /*followingActions: new Ember.A(),

    // when user visits home page
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
    }.observes('initialized', 'currentUser.following.length'),*/

    /**
     * @Observes Set the Generated SRS test
     */
    setGSRTest: function () {
        if (!this.get('currentUser.tests.length'))
            return;

        this.get('currentUser.tests')
            .forEach(function (test) {
                if (test.get('isSpacedRepetition')) {
                    this.set('currentUser.gsrTest', test);
                }
            }.bind(this));
    }.observes('currentUser.tests.length'),

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
            this.set('homeIsGroups', false);

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
                case 'groups':
                    this.set('homeIsGroups', true);
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
        },

        indexLearnMoreScroll: function () {
            Ember.$('html, body').animate({
                scrollTop: $("#learn-more-flag").offset().top + 'px'
            }, 'slow');
        }
    }
});
