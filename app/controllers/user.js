// Syntax fixed previously
import Ember from 'ember';
import CurrentUser from '../mixins/current-user';
import ParseHelper from '../utils/parse-helper';
import EmberParseAdapter from '../adapters/parse';

export default Ember.ObjectController.extend(CurrentUser, {
    loading: {
        autocompleteInstitutionNames: false
    },

    isMainListRecentActivity: true,
    isMainListTests: false,

    isCurrentUser: function () {
        return this.get('currentUser.id') === this.get('model.id');
    }.property('model.id'),

    isFollowing: function () {
        if (!this.get('isCurrentUser') && this.get('currentUser.following.length')) {
            return this.get('currentUser.following').contains(this.get('model'));
        } else {
            return false;
        }
    }.property('isCurrentUser', 'currentUser.following.length'),

    coverImageStyle: function () {
        var coverImageURL = this.get('coverImageURL'),
            coverImageOffsetY = this.get('coverImageOffsetY');
        if (!coverImageOffsetY)
            coverImageOffsetY = 0;
        return "background-image:url(" + coverImageURL + ");background-position:center " + coverImageOffsetY + "%;";
    }.property('coverImageURL.length', 'coverImageOffsetY'),

    isEditMode: false,

    courseFacebookPageUrl: function () {
        if (!this.get('course.facebookId'))
            return "/";
        return "https://www.facebook.com/" + this.get('course.facebookId');
    }.property('course.facebookId'),

    institutionFacebookPageUrl: function () {
        if (!this.get('institution.facebookId'))
            return;
        return "https://www.facebook.com/" + this.get('institution.facebookId');
    }.property('institution.facebookId'),

    tests: [],

    getTests: function () {
        if (!this.get('model.id'))
            return;

        this.get('tests').clear();

        var where = {
            author: ParseHelper.generatePointer(this.get('model'))
        };
        this.store.findQuery('test', {
            where: JSON.stringify(where),
            include: ["author"],
            order: 'title'
        }).then(function (tests) {
            this.get('tests').addObjects(tests);
        }.bind(this));
    }.observes('model'),

    userActions: [],

    /*getUserActionsAndModify: function () {
        if (!this.get('model.id'))
            return;

        this.get('userActions').clear();
        var query = {
            user: ParseHelper.generatePointer(this.get('model')),
            type: {"$nin": ["questionAnswered", "attemptStarted"]}
        };
        this.store.findQuery('action', {
            where: JSON.stringify(query),
            order: "-createdAt",
            limit: 15
        }).then(function (userActions) {
            userActions.forEach(function (userAction) {
                switch (userAction.get('type')) {
                    case "joinedMyCQs":
                        userAction.set('title', " joined MyCQs!");
                        break;
                    case "testCreated":
                        userAction.set('title', " created a new test");
                        break;
                    case "attemptFinished":
                        userAction.set('title', " took a test");
                        break;
                }
            }.bind(this));
            this.get('userActions').addObjects(userActions);
        }.bind(this));
    }.observes('model'),*/

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
        if (!this.get('education'))
            return [];
        return this.get('education').sort(function (a, b) {
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

    /*
     * Edit mode
     */
    temporaryChanges: {
        name: null,
        profilePicture: null,
        profileImageURL: null,
        coverPicture: null,
        coverImageURL: null,
        coverImageStyle: null
    },

    /*
     * Used to prevent transitions during
     * Edit mode if dirty.
     */
    isEditModeDirtied: function () {
        var temporaryChanges = this.get('temporaryChanges');
        if (temporaryChanges.name !== this.get('name')) {
            return true;
        } else if (temporaryChanges.profilePicture || temporaryChanges.coverPicture) {
            return true;
        } else {
            return false;
        }
    }.property('temporaryChanges.name.length', 'temporaryChanges.profilePicture', 'temporaryChanges.coverPicture'),

    actions: {

        enableEditMode: function () {
            this.set('temporaryChanges.name', this.get('name'));
            this.set('isEditMode', true);
        },

        cancelEditMode: function () {
            this.set('temporaryChanges.name', '');
            this.set('temporaryChanges.profileImage', null);
            this.set('temporaryChanges.profileImageURL', null);
            this.set('temporaryChanges.coverPicture', null);
            this.set('temporaryChanges.coverImageURL', null);
            this.set('temporaryChanges.coverImageStyle', null);
            this.set('isEditMode', false);
        },

        saveEditModeChanges: function () {
            if (this.get('temporaryChanges.name.length'))
                this.set('model.name', this.get('temporaryChanges.name'));
            this.send('incrementLoadingItems');
            if (this.get('temporaryChanges.profileImageURL.length')) {
                var profilePicture = new EmberParseAdapter.File(this.get('temporaryChanges.profilePicture').name(),
                    this.get('temporaryChanges.profilePicture').url());
                this.set('profilePicture', profilePicture);
            }
            if (this.get('temporaryChanges.coverImageURL.length')) {
                var coverPicture = new EmberParseAdapter.File(this.get('temporaryChanges.coverPicture').name(),
                    this.get('temporaryChanges.coverPicture').url());
                this.set('coverImage', coverPicture);
            }
            this.get('model').save().then(function () {
                this.send('decrementLoadingItems');
            }.bind(this));
            this.send('cancelEditMode');
        },

        toggleEditProfileImageDropdown: function () {
            this.toggleProperty('shouldShowEditProfileImageDropdown');
        },

        toggleEditCoverImageDropdown: function () {
            this.toggleProperty('shouldShowEditCoverImageDropdown');
        },

        uploadProfileImagePhoto: function () {
            this.send('incrementLoadingItems');
            var file = document.getElementById("profileImageInput").files[0];
            var parseFile = new Parse.File('profile-image.jpg', file);
            return parseFile.save().then(function (image) {
                this.send('decrementLoadingItems');
                this.set('temporaryChanges.profilePicture', image);
                this.set('temporaryChanges.profileImageURL', image.url());
                this.set('shouldShowEditProfileImageDropdown', false);
            }.bind(this));
        },

        uploadCoverImagePhoto: function () {
            this.send('incrementLoadingItems');
            var file = document.getElementById("coverImageInput").files[0];
            var parseFile = new Parse.File('cover-image.jpg', file);
            return parseFile.save().then(function (image) {
                this.send('decrementLoadingItems');
                this.set('temporaryChanges.coverPicture', image);
                this.set('temporaryChanges.coverImageURL', image.url());
                this.set('temporaryChanges.coverImageStyle', "background-image:url(" + this.get('temporaryChanges.coverImageURL') + ");");
                this.set('shouldShowEditCoverImageDropdown', false);
            }.bind(this));
        },

        removeProfileImage: function () {
            this.set('profilePicture', null);
            this.set('temporaryChanges.profilePicture', null);
            this.set('temporaryChanges.profileImageURL', null);
        },

        removeCoverImage: function () {
            this.set('coverImage', null);
            this.set('temporaryChanges.coverImage', null);
            this.set('temporaryChanges.coverImageURL', null);
        },

        switchList: function (list) {
            switch (list) {
                case "recentActivity":
                    this.set('isMainListRecentActivity', true);
                    this.set('isMainListTests', false);
                    break;
                case "tests":
                    this.set('isMainListRecentActivity', false);
                    this.set('isMainListTests', true);
                    break;
            }
        },

        educationalInstitutionSelected: function (object) {
            if (!object) {
                this.set('newEducationCohort.institution', undefined);
                return;
            }
            var facebookId;
            if (object.recordType === "facebook")
                facebookId = object.id;
            else
                facebookId = object.facebookId;
            ParseHelper.cloudFunction(this,'createOrUpdateEducationalInstitution', {
                name: object.name,
                facebookId: facebookId,
                type: object.category // from facebook // TODO need non-facebook input
            }).then(function (result) {
                var institution = ParseHelper.extractRawPayload(this.store, 'institution', result);
                this.set('newEducationCohort.institution', institution);
            }.bind(this), function (error) {
                console.dir(error);
            });
        },

        studyFieldSelected: function (object) {
            if (!object) {
                this.set('newEducationCohort.institution', undefined);
                return;
            }

            var facebookId;
            if (object.recordType === "facebook")
                facebookId = object.id;
            else
                facebookId = object.facebookId;
            ParseHelper.cloudFunction(this, 'createOrUpdateStudyField', {
                name: object.name,
                facebookId: facebookId
            }).then(function (result) {
                var studyField = ParseHelper.extractRawPayload(this.store, 'study-field', result);
                this.set('newEducationCohort.studyField', studyField);
            }.bind(this), function (error) {
                console.dir(error);
            });
        },

        saveEducationCohort: function (callback) {
            var promise;
            if (this.get('studyingAtUniversity')) {
                promise = ParseHelper.cloudFunction(this, 'createOrGetEducationCohort', {
                    educationalInstitutionId: this.get('newEducationCohort.institution.id'),
                    studyFieldId: this.get('newEducationCohort.studyField.id'),
                    currentYear: this.get('newEducationCohort.currentYear'),
                    graduationYear: this.get('newEducationCohort.graduationYear')
                });
            } else {
                promise = ParseHelper.cloudFunction(this,'createOrGetEducationCohort', {
                    educationalInstitutionId: this.get('newEducationCohort.institution.id')
                });
            }
            callback(promise);

            promise.then(function (result) {
                this.send('closeModal');
                var educationCohort = ParseHelper.extractRawPayload(this.store, 'education-cohort', result);
                this.set('educationCohort', educationCohort);
                this.get('model').save();
            }.bind(this), function (error) {
                console.dir(error);
            });
        },

        clearAutocompleteList: function () {
            this.get('autocompleteInstitutionNames').clear();
            this.get('autocompleteCourseNames').clear();
        },

        followAllFacebookFriends: function () {
            this.send('bulkFollow', this.get('facebookFriendsOnMyCQs'));
        },

        followAllSuggestedFollowing: function (callback) {
            this.send('bulkFollow', this.get('suggestedFollowingAll'), callback);
        },

        /*
         * First time login actions
         */

        welcomePersonaliseNow: function (isPositive) {
            if (isPositive) {
                this.send('enableEditMode');
                this.set('hasBegunEditingProfile', true);
            }
        },

        welcomeFindFacebookFriends: function (isPositive) {
            if (isPositive) {
                this.send('openModal', 'user/modal/facebook-friends', 'user');
            }

        },

        createFirstTest: function (isPositive) {
            if (isPositive) {
                this.transitionTo('create');
            }
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
