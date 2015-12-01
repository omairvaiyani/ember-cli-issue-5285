import Ember from 'ember';
import CurrentUser from '../mixins/current-user';
import TagsAndCats from '../mixins/tags-and-cats';
import SortBy from '../mixins/sort-by';
import EstimateMemoryStrength from '../mixins/estimate-memory-strength';
import DeleteWithUndo from '../mixins/delete-with-undo';
import ProgressCharts from '../mixins/progress-charts';
import ParseHelper from '../utils/parse-helper';


export default
Ember.Controller.extend(CurrentUser, TagsAndCats, SortBy, EstimateMemoryStrength, DeleteWithUndo, ProgressCharts, {
    needs: ['application'],

    applicationController: function () {
        return this.get('controllers.application');
    }.property('controllers.length'),

    /**
     * @Property Show Guest Page
     * Only show guest page if
     * - On index.index without currentUser.
     *
     * @return {boolean}
     */
    showGuestPage: function () {
        var currentPath = this.get('applicationController.currentPath');

        if(currentPath === "index.index" && !this.get('currentUser'))
            return true;

    }.property('currentUser', 'applicationController.currentPath.length'),

    /**
     * @Property Show User Page
     * Only show user page if
     * - On index.* with currentUser
     * - OR, index.user without currentUser
     *
     * @return {boolean}
     */
    showUserPage: function () {
        var currentPath = this.get('applicationController.currentPath');
        if(this.get('currentUser') || currentPath === "index.user")
            return true;

    }.property('currentUser', 'applicationController.currentPath.length'),

    /**
     * @Property Show Current User Mini Profile
     * Only show if
     * - On index.index with currentUser
     * @return {boolean}
     */
    showCurrentUserMiniProfile: function () {
        var currentPath = this.get('applicationController.currentPath');
        if(this.get('currentUser') || currentPath === "index.index")
            return true;

    }.property('currentUser', 'applicationController.currentPath.length'),

    /*
     * GUEST MODE
     */
    onboardUser: function () {
        return this.store.createRecord('parse-user', {
            studying: "", studyingAt: "", placeOfStudy: "", studyYear: "",
            moduleTags: new Ember.A()
        });
    }.property(),

    onboardingFirstInput: "",
    onboardingStudyExamples: ["Finance", "Medicine", "for Work", "Aviation", "A-Levels", "Spanish"],
    onboardingFirstInputSetFocus: function () {
        var _this = this;
        setTimeout(function () {
            if (!_this.get('currentUser'))
                $("#onboarding-firstInput").focus();
        }, 800);
    }.on('init'),

    onboardingFirstCTAFocus: function () {
        if (!this.get('onboardingFirstInput.length')) {
            $("#onboarding-firstCTA").removeClass("focus");
            $(".onboarding-studyExamples").removeClass("invisible");
        } else {
            $("#onboarding-firstCTA").addClass("focus");
            $(".onboarding-studyExamples").addClass("invisible");
        }
    },
    onboardingFirstCTAFocusAfterTyping: function () {
        Ember.run.debounce(this, this.onboardingFirstCTAFocus, 450);
    }.observes('onboardingFirstInput.length'),

    showStats: false,

    stats: {
        numberOfUsers: 15000,
        numberOfTests: 1200,
        numberOfQuestions: 258800,
        numberOfAttempts: 97500
    },
    /**
     * @Function Should Show Stats
     *
     * Called from ApplicationController.currentPathDidChange
     * Only if a guest visits the homepage.
     * This trigger is removed on IndexRoute exit.
     */
    shouldShowStats: function () {
        var _this = this;
        setTimeout(function () {
            $(function () {
                var oTop = $('#stats-row').offset().top - window.innerHeight;
                $(window).scroll(function () {
                    var pTop = $('body').scrollTop();
                    if (pTop > oTop) {
                        _this.set('showStats', true);
                    }
                });
            });
        }, 800);
    },

    /**
     * @Function Resize Index Cover Video
     *
     * Called from ApplicationController.currentPathDidChange
     * Only if a guest visits the homepage.
     * This trigger is removed on IndexRoute exit.
     */
    resizeIndexCoverVideo: function () {
        var calculateHeight = function () {
            var height = $(window).outerHeight() - 140;
            if (height < 400)
                height = 400;
            else if (height > 620)
                height = 620;
            return height;
        };

        // for the window resize
        $(window).ready(function () {
            // Set it first, but need a delay
            setTimeout(function () {
                var height = calculateHeight();
                $('.index-page-cover').css('height', height + 'px');
            }, 200);
            // Set resize trigger
            $(window).resize(function () {
                var height = calculateHeight();
                $('.index-page-cover').css('height', height + 'px');
            });
        }.bind(this));

    },

    /*
     * HOME MODE
     */
    // Needed by SortByMixin and TestCardComponent
    controllerId: "myTests",

    /**
     * @Property Navigation Tabs
     */
    navigationTabs: function () {
        var navigationTabs = new Ember.A();
        _.each([{value: "overview", title: "Overview", active: false},
                {value: "activities", title: "Activities", active: false},
                {value: "tests", title: "Tests", active: false, partial: "index/user/my-tests"},
                {value: "progress", title: "Progress", active: false, partial: "index/user/my-progress"}],
            function (tabData) {
                navigationTabs.pushObject(Ember.Object.create(tabData));
            });
        return navigationTabs;
    }.property(),

    setDefaultNavigationTab: function () {
        if (localStorage.getItem(this.get('controllerId') + 'NavigationTab')) {
            var navigationTab = this.get('navigationTabs').findBy('value',
                localStorage.getItem(this.get('controllerId') + 'NavigationTab'));
            this.send('switchTab', navigationTab);
        } else {
            this.get('navigationTabs').findBy('value', 'tests').set('active', true);
        }
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
        /*
         * GUEST MODE
         */
        indexLearnMoreScroll: function () {
            $('html, body').animate({
                scrollTop: $("#learn-more-flag").offset().top
            }, 400);
        },

        indexBackToTopScroll: function () {
            $('html, body').animate({
                scrollTop: $("#join-beta-flag").offset().top + 150
            }, 400);
            $("#mce-EMAIL").focus();
        },

        onboardingFillFirstInput: function (example) {
            this.set('onboardingFirstInput', example);
            this.onboardingFirstCTAFocus();
        },

        onboardingFirstCTA: function () {
            // Begin on boarding
            this.set('onboardUser.studying', this.get('onboardingFirstInput'));
            this.transitionTo("onboarding");
        },

        subscribeEmailForBeta: function () {
            $("#mc-embedded-subscribe-form").submit();
        },

        /*
         * USER MODE
         */
        switchTab: function (tab) {
            this.get('navigationTabs').forEach(function (o) {
                o.set('active', false);
            });
            tab.set('active', true);
            localStorage.setItem(this.get('controllerId') + 'NavigationTab', tab.get('value'));

            switch (tab.value) {
                case "overview":

                    break;
                case "activities":

                    break;
                case "tests":

                    break;
                case "progress":
                    this.send('fetchTestAttempts');
                    break;
                default:

                    break;
            }

        },

        fetchTestAttempts: function (user) {
            if (!user)
                user = this.get('currentUser');
            if (!user)
                return console.log("Error, index.actions.fetchTestAttempts - no user or currentUser.");
            if (user.get('testAttempts.length'))
                return console.log("Test attempts already fetched for user.");

            var where = {
                "user": ParseHelper.generatePointer(user, "_User"),
                "createdAt": {
                    "$gte": moment().startOf("day").subtract(31, "d").toDate().toISOString()
                }
            };
            ParseHelper.findQuery(this, 'attempt', {where: where}).then(function (attempts) {
                if (user) {
                    user.get('testAttempts').clear();
                    user.get('testAttempts').addObjects(attempts.sortBy('createdAt'));
                }
            }, function (error) {
                console.dir(error);
            });
        },

        deleteTest: function (test) {
            this.send('deleteObject', {
                array: this.get('currentUser.createdTests'), object: test,
                title: "Test deleted!", message: test.get('title')
            });
        },

        // Callback from DeleteWithUndoMixin
        preObjectDelete: function (returnItem) {
            if (returnItem.type === "test") {
                // If a user filtered to find a test to delete, clear the filter.
                if (this.get('myTestsList.length') === 1 && this.get('myTestsListFilter.length')) {
                    this.set('myTestsListFilter', "");
                }
            }
        },

        undoObjectDelete: function (returnItem, error) {
            // Called if object delete is undo'd,
            // TODO see if scrolling to test helps
        },

        dismissLatestSRTest: function () {
            this.send('addNotification',
                {type: "clock", title: "Test dismissed for now", message: "You can still take it later."});

            this.set('currentUser.srLatestTestDismissed', true);
            this.get('currentUser').save();
        }

    }
});
