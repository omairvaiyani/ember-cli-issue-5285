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

    // TODO check if this is running ONLY when needed
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

    // TODO is this code deprecated
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

    homeIsGroups: false,

    tests: [],

    testsAreOrderedByTitle: true,
    testsOrderedByTitle: function () {
        if (!this.get('currentUser.tests'))
            return [];
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
    // TODO should this be in ApplicationController.initializeCurrentUser
    // If so, might be optimisable, merge queries or something
    getCurrentUsersTests: function () {
        if (!this.get('currentUser'))
            return;

        if (!this.get('currentUser.tests'))
            this.set('currentUser.tests', Em.A());

        var where = {
            author: ParseHelper.generatePointer(this.get('currentUser')),
            isObjectDeleted: {
                "$ne": true // undefined !== false, hence using not equal to True.
            },
            isSpacedRepetition: {
                "$ne": true
            }
        };
        // TODO will removing include speed up query, seeing as RESTAdapater doesn't use it
        this.store.findQuery('test', {where: JSON.stringify(where), order: 'title', include: 'category,author'})
            .then(function (tests) {
                this.get('currentUser.tests').clear();
                this.get('currentUser.tests').addObjects(tests);
            }.bind(this));
    }.observes('initialized', 'currentUser.id'),

    followingActions: [],
    // TODO do we need this all the time or better to load
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
        // TODO will removing include speed up query
        this.store.findQuery('action', {
            where: JSON.stringify(query),
            order: "-createdAt",
            include: "user,test.category.parent",
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

    // TODO are we not doing this in ApplicationController.initializeCurrentUser
    // If so, are queries duplicating?
    getGroups: function () {
        if (this.get('currentUser.groups.length'))
            return;
        return this.get('currentUser').getGroups(this.store);
        var where = {
            creator: ParseHelper.generatePointer(this.get('currentUser', "_User"))
        };
        this.store.findQuery("group", {where: JSON.stringify(where)})
            .then(function (groups) {
                this.get('currentUser.groups').clear();
                this.get('currentUser.groups').addObjects(groups);
            }.bind(this));
    }.observes('homeIsGroups'),

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
