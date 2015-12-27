// Syntax fixed previously
import Ember from 'ember';
import CurrentUser from '../../mixins/current-user';
import ParseHelper from '../../utils/parse-helper';
import SortBy from '../../mixins/sort-by';
import DeleteWithUndo from '../../mixins/delete-with-undo';

export default Ember.Controller.extend(CurrentUser, SortBy, DeleteWithUndo, {
    // Needed by SortByMixin and TestCardComponent
    controllerId: "myTests",

    isCurrentUser: function () {
        return this.get('currentUser.id') === this.get('model.id');
    }.property('model.id'),

    showCreateFirstQuiz: function () {
        return this.get('isCurrentUser') && this.get('currentUser.numberOfTestsCreated') === 0;
    }.property('isCurrentUser', 'currentUser.numberOfTestsCreated'),

    isFollowing: function () {
        if (!this.get('isCurrentUser') && this.get('currentUser.following.length')) {
            return this.get('currentUser.following').contains(this.get('model'));
        } else {
            return false;
        }
    }.property('isCurrentUser', 'currentUser.following.length'),

    friendsListTab: "followers",

    friendsShouldShowFollowers: function () {
        return this.get('friendsListTab') === "followers";
    }.property('friendsListTab'),

    friendsShouldShowFollowing: function () {
        return this.get('friendsListTab') === "following";
    }.property('friendsListTab'),

    friendsShouldShowSearch: function () {
        return this.get('friendsListTab') === "search";
    }.property('friendsListTab'),

    /**
     * @Property
     * For the User to select what tests
     * to include in the myTests list
     * by way of a radio button group.
     */
    myTestsListIsFavourites: function () {
        return this.get('myTestsListType').value === "savedTests";
    }.property('myTestsListType'),

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
        var myTestsList = this.get('model.' + this.get('myTestsListType.value')),
            finalList = new Ember.A();
        if (!this.get('model'))
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
                propertiesToFilter = ['title', 'description', 'tags', 'category.name'];

            finalList = finalList.filter(function (test) {
                var match = false;
                _.each(propertiesToFilter, function (prop) {
                    if (match)
                        return;
                    if (prop === 'tags' && test.get(prop + '.length')) {
                        _.each(test.get(prop), function (tag) {
                            if(match)
                                return;
                            if (tag.toLowerCase().match(regex))
                                match = true;
                        });
                    } else if (test.get(prop + ".length") && test.get(prop).toLowerCase().match(regex)) {
                        match = true;
                    }
                });
                return match;
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

        window.scrollTo(0, 0);
    },

    /**
     * @Throttle
     * Throttles the myTestsList from updating
     * multiple times as createdTests and savedTests
     * are added/removed in quick succession.
     */
    myTestsListThrottle: function () {
        Ember.run.debounce(this, this.myTestsListUpdate, 200);
    }.observes('model.id.length', 'model.myTests.length', 'myTestsListType', 'listOrder', 'myTestsListFilter.length',
        'model.myTests.@each.title.length', 'model.myTests.@each.createdAt',
        'model.myTests.@each.memoryStrength', 'activeTags.length', 'activeCategories.length'),

    myTestsListFilterPlaceholder: function () {
        if (this.get('isCurrentUser')) {
            return "Search your quizzes";
        } else {
            return "Search " + this.get('model.name') + "' Quizzes";
        }
    }.property('isCurrentUser', 'model'),

    /*
     * COURSE SELECTION
     */
    studyingAt: null,
    studyingAtUniversity: function () {
        if (!this.get('studyingAt'))
            return false;

        return this.get('studyingAt') === 'University';
    }.property('studyingAt.length'),

    newEducationCohort: null,

    setNewEducationCohort: function () {
        var newEducationCohort;
        if (this.get('educationCohort.institution.id')) {
            var studyingAt = this.get('educationCohort.institution.type');
            if (!studyingAt)
                studyingAt = "University";
            this.set('studyingAt', studyingAt);
            newEducationCohort = this.store.createRecord('education-cohort', {
                institution: this.get('educationCohort.institution'),
                studyField: this.get('educationCohort.studyField'),
                currentYear: this.get('educationCohort.currentYear'),
                graduationYear: this.get('educationCohort.graduationYear')
            });
        } else {
            this.set('studyingAt', 'University');
            newEducationCohort = this.store.createRecord('education-cohort', {
                currentYear: "Year 1"
            });
        }
        this.set('newEducationCohort', newEducationCohort);
    }.observes('educationCohort.institution.id.length'),

    studyYearsToChooseFrom: [
        "Foundation Year", "Year 1", "Year 2", "Year 3",
        "Year 4", "Year 5", "Year 6", "Intercalation Year",
        "Master's", "Ph.D", "Professional Education"
    ],
    studyLengthsToChooseFrom: [1, 2, 3, 4, 5, 6, 7],
    /*
     * FACEBOOK EDUCATION LIST
     */
    facebookEducation: function () {
        if (!this.get('fbEducation'))
            return [];
        return this.get('fbEducation').sort(function (a, b) {
            return parseInt(b.year.name) - parseInt(a.year.name);
        });
    }.property('education.length'),

    selectedCourse: null,


    latestAttemptsReceived: false,
    getLatestAttempts: function () {
        if (this.get('latestAttempts.length'))
            this.set('latestAttemptsReceived', true);
    }.observes('latestAttempts.length'),

    /*
     * Suggestions for following
     */
    suggestedFollowing: Ember.A(), // 5 suggestions
    suggestedFollowingAll: Ember.A(), // No limit

    mergeSuggestedFollowings: function () {
        if (!this.get('isCurrentUser') || !this.get('currentUser.following') ||
            (!this.get('courseSuggestedFollowing.length') && !this.get('facebookFriendsOnMyCQs.length')))
            return;
        var array = Ember.A();
        this.get('courseSuggestedFollowing').forEach(function (user) {
            if (!this.get('currentUser.following').contains(user))
                array.pushObject(user);
        }.bind(this));
        array.addObjects(this.get('courseSuggestedFollowing'));
        if (this.get('facebookFriendsOnMyCQs.length')) {
            /*
             * Check for duplicate users
             */
            this.get('facebookFriendsOnMyCQs').forEach(function (user) {
                if (!array.contains(user) && !this.get('currentUser.following').contains(user))
                    array.pushObject(user);
            }.bind(this));
        }
        this.get('suggestedFollowing').clear();
        this.get('suggestedFollowing').addObjects(_.shuffle(array).splice(0, 5));
        this.get('suggestedFollowingAll').clear();
        this.get('suggestedFollowingAll').addObjects(_.shuffle(array));
    }.observes('courseSuggestedFollowing.length', 'facebookFriendsOnMyCQs.length'),

    throttleMergeSuggestedFollowing: function () {
        Ember.run.debounce(this, this.mergeSuggestedFollowings, 500);
    }.observes('currentUser.following.length'),

    shouldShowFollowAllSuggestedFollowing: function () {
        if (!this.get('suggestedFollowingAll.length')) {
            return false;
        } else {
            var areThereUsersToFollow = false;
            this.get('suggestedFollowingAll').forEach(function (user) {
                if (!this.get('currentUser.following').contains(user)) {
                    areThereUsersToFollow = true;
                    return areThereUsersToFollow;
                }
            }.bind(this));
            return areThereUsersToFollow;
        }
    }.property('suggestedFollowingAll.length', 'currentUser.following.length'),

    /*
     * Course suggested following
     */
    courseSuggestedFollowing: Ember.A(),

    isGettingCourseSuggestedFollowing: false,

    getCourseSuggestedFollowing: function () {
        if (this.get('isGettingCourseSuggestedFollowing') || !this.get('isCurrentUser')
            || !this.get('educationCohort.id.length'))
            return;
        this.set('isGettingCourseSuggestedFollowing', true);
        var where = {
            educationCohort: ParseHelper.generatePointer(this.get('educationCohort'), 'EducationCohort')
        };
        this.store.find('parse-user', {where: JSON.stringify(where)})
            .then(function (results) {
                this.get('courseSuggestedFollowing').clear();
                results.removeObject(this.get('model'));
                this.get('courseSuggestedFollowing').addObjects(results);
                this.set('isGettingCourseSuggestedFollowing', false);
            }.bind(this));
    }.observes('educationCohort.id'),

    /*
     * Facebook friends
     */
    facebookFriendsOnMyCQs: Ember.A(),

    shouldShowFollowAllFacebookFriends: function () {
        if (!this.get('facebookFriendsOnMyCQs') || !this.get('facebookFriendsOnMyCQs.length')) {
            return false;
        } else {
            var areThereUsersToFollow = false;
            this.get('facebookFriendsOnMyCQs').forEach(function (user) {
                if (!this.get('currentUser.following').contains(user)) {
                    areThereUsersToFollow = true;
                    return areThereUsersToFollow;
                }
            }.bind(this));
            return areThereUsersToFollow;
        }
    }.property('facebookFriendsOnMyCQs.length', 'currentUser.following.length'),

    getFacebookFriends: function () {
        if (!this.get('fbid'))
            return;
        var where = {
            fbid: {
                "$in": this.get('facebookFriends')
            }
        };
        this.store.find('parse-user', {where: JSON.stringify(where)})
            .then(function (results) {
                this.get('facebookFriendsOnMyCQs').clear();
                this.get('facebookFriendsOnMyCQs').addObjects(results);
            }.bind(this));
    }.observes('fbid'),


    actions: {
        resetPage: function () {
            var controller = this;
            controller.send('switchTabInFriendsList', 'followers');
            controller.set('myTestsListType', controller.get('myTestsListTypes')[0]);
            controller.set('myTestsListFilter', '');
        },

        /**
         * Test List Filtering
         */

        /**
         * @Action Toggle Favourites Filter
         */
        toggleFavouritesFilter: function () {
            if (this.get('myTestsListIsFavourites'))
                this.set('myTestsListType', this.get('myTestsListTypes')[0]);
            else
                this.set('myTestsListType', this.get('myTestsListTypes')[2]);
        },

        removeImage: function () {
            this.set('model.profilePicture', undefined);

            this.send('incrementLoadingItems');
            this.get('model').save().then(function () {

            }, function (error) {
                console.dir(error);
            }).then(function () {
                this.send('decrementLoadingItems');
            }.bind(this));
        },

        saveUploadedImage: function (imageData) {
            this.set('model.profilePicture', imageData);

            this.send('incrementLoadingItems');
            this.get('model').save().then(function () {

            }, function (error) {
                console.dir(error);
            }).then(function () {
                this.send('decrementLoadingItems');
            }.bind(this));
        },

        switchTabInFriendsList: function (tab) {
            this.set('friendsListTab', tab);
        },

        deleteTest: function (test) {
            if (test.get('author.id') === this.get('currentUser.id')) {
                this.send('deleteObject', {
                    array: this.get('currentUser.createdTests'), object: test,
                    title: "Quiz deleted!", message: test.get('title')
                });
            } else {
                // Called by Admin
                this.send('deleteObject', {
                    array: test.get('author.createdTests'), object: test,
                    title: "[ADMIN] Quiz deleted!", message: test.get('title')
                });
            }
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
        }
    },

    /*
     * First time login
     */
    firstTimeLoginMode: function () {
        /*if (this.get('isCurrentUser') && !this.get('finishedWelcomeTutorial')) {
         /this.set('finishedWelcomeTutorial', true);
         this.get('model').save();
         this.send('addNotification', 'welcome', 'Welcome to MyCQs!', "This is your new profile page!");
         var confirm = {
         controller: this,
         callbackAction: 'welcomePersonaliseNow',
         positive: "Personalise now",
         negative: "Later"
         };
         this.send('addNotification', 'profile', 'Would you like to personalise it now?', "", confirm);
         }*/
    }.observes('isCurrentUser'),

    hasBegunEditingProfile: false,

    hasFinishedEditingProfile: function () {
        if (this.get('hasBegunEditingProfile') && !this.get('isEditMode')) {
            this.send('addNotification', 'profile', 'Great!', "You can always edit your profile " +
                "by clicking 'Edit profile'");

            var confirmFacebookFriends = {
                controller: this,
                callbackAction: 'welcomeFindFacebookFriends',
                positive: "Find people",
                negative: "Later"
            };

            var confirmCreateTest = {
                controller: this,
                callbackAction: 'createFirstTest',
                positive: "Create now",
                negative: "Later"
            };

            if (this.get('facebookFriends.length')) {
                this.send('addNotification', 'facebook', 'Follow your friends',
                    'You have ' + this.get('facebookFriends.length') + ' friends on MyCQs!',
                    confirmFacebookFriends);

                setTimeout(function () {
                    this.send('addNotification', 'create', '', "Would you like to create your first test?",
                        confirmCreateTest);
                }.bind(this), 15000);
            } else {
                this.send('addNotification', 'create', 'Great!', "Would you like to create your first test?",
                    confirmCreateTest);
            }
        }
    }.observes('isEditMode', 'hasBegunEditingProfile')

});
