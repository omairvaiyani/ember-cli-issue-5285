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

import EmberParseAdapter from '../adapters/parse';

export default
    Ember.ObjectController.extend(CurrentUser, {
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

        getUserActionsAndModify: function () {
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
        }.observes('model'),

        /*
         * COURSE SELECTION
         */

        /*
         * NEW COURSE
         */
        newCourse: {
            institutionName: '',
            courseName: '',
            yearNumber: 1,
            canBeSaved: false
        },
        prefillNewCourseWithEducationInfo: function () {
            if (this.get('institution.fullName.length'))
                this.set('newCourse.institutionName', this.get('institution.fullName'));
            if (this.get('course.name.length'))
                this.set('newCourse.courseName', this.get('course.name'));
            if (this.get('yearNumber') !== "")
                this.set('newCourse.yearNumber', this.get('yearNumber'));
        }.observes('course.fullName.length', 'institution.fullName.length', 'yearNumber'),
        canNewCourseBeSaved: function () {
            if (this.get('institution.fullName') === this.get('newCourse.institutionName') &&
                this.get('course.name') === this.get('newCourse.courseName') &&
                this.get('yearNumber') === this.get('newCourse.yearNumber'))
                this.set('newCourse.canBeSaved', false);
            else
                this.set('newCourse.canBeSaved', this.get('newCourse.institutionName.length') && this.get('newCourse.courseName.length'));
        }.observes('newCourse.institutionName.length', 'newCourse.courseName.length', 'newCourse.yearNumber'),

        courseYearsToChooseFrom: [0, 1, 2, 3, 4, 5, 6],
        courseLengthsToChooseFrom: [1, 2, 3, 4, 5, 6, 7],

        autocompleteInstitutionNames: [],

        getInstitutionNamesForAutocomplete: function () {
            if (this.get('newCourse.institutionName.length') < 2) {
                this.get('autocompleteInstitutionNames').clear();
                this.set('loading.autocompleteInstitutionNames', false);
                return;
            }
            this.set('loading.autocompleteInstitutionNames', true);
            var stopWords = ParseHelper.stopWords,
                tags = _.filter(this.get('newCourse.institutionName').toLowerCase().split(' '), function (w) {
                    return w.match(/^\w+$/) && !_.contains(stopWords, w);
                });
            var where = {
                "tags": {
                    "$all": tags
                }
            };
            this.store.findQuery('institution-list', {where: JSON.stringify(where)})
                .then(function (institutionList) {
                    this.set('loading.autocompleteInstitutionNames', false);
                    this.get('autocompleteInstitutionNames').clear();
                    if (institutionList.get('content.length'))
                        this.get('autocompleteInstitutionNames').addObjects(institutionList.get('content').slice(0,5));

                }.bind(this));
        },

        getCourseNamesForAutocomplete: function () {
            if (this.get('newCourse.courseName.length') < 2) {
                this.get('autocompleteCourseNames').clear();
                this.set('loading.autocompleteCourseNames', false);
                return;
            }
            this.set('loading.autocompleteCourseNames', true);
            var stopWords = ParseHelper.stopWords,
                tags = _.filter(this.get('newCourse.courseName').toLowerCase().split(' '), function (w) {
                    return w.match(/^\w+$/) && !_.contains(stopWords, w);
                });
            var where = {
                "tags": {
                    "$all": tags
                }
            };
            this.store.findQuery('course-list', {where: JSON.stringify(where)})
                .then(function (courseList) {
                    this.set('loading.autocompleteCourseNames', false);
                    this.get('autocompleteCourseNames').clear();
                    if (courseList.get('content.length'))
                        this.get('autocompleteCourseNames').addObjects(courseList.get('content').slice(0,5));

                }.bind(this));
        },

        throttleAutocompleteInstitutionNames: function () {
         Ember.run.debounce(this, this.getInstitutionNamesForAutocomplete, 250);
         }.observes("newCourse.institutionName.length"),

        autocompleteCourseNames: [],

        throttleAutocompleteCourseNames: function () {
            Ember.run.debounce(this, this.getCourseNamesForAutocomplete, 250);
        }.observes("newCourse.courseName.length"),

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
        suggestedFollowing: Ember.A(),

        mergeSuggestedFollowings: function () {
            if (this.get('courseSuggestedFollowing.length') || this.get('facebookFriendsOnMyCQs.length')) {
                var array = Ember.A();
                array.addObjects(this.get('courseSuggestedFollowing'));
                if (array.length && this.get('facebookFriendsOnMyCQs.length')) {
                    /*
                     * Check for duplicate users
                     */
                    this.get('facebookFriendsOnMyCQs').forEach(function (user) {
                        if (!array.contains(user))
                            array.pushObject(user);
                    });
                } else if (this.get('facebookFriendsOnMyCQs.length')) {
                    array.addObjects(this.get('facebookFriendsOnMyCQs'));
                }
                this.get('suggestedFollowing').clear();
                this.get('suggestedFollowing').addObjects(_.shuffle(array).splice(0, 5));
            }
        }.observes('courseSuggestedFollowing.length', 'facebookFriendsOnMyCQs.length'),

        /*
         * Course suggested following
         */
        courseSuggestedFollowing: Ember.A(),

        isGettingCourseSuggestedFollowing: false,

        getCourseSuggestedFollowing: function () {
            if (this.get('isGettingCourseSuggestedFollowing') || !this.get('isCurrentUser') || !this.get('course.name'))
                return;
            this.set('isGettingCourseSuggestedFollowing', true);
            var where = {
                course: ParseHelper.generatePointer(this.get('course.content'), 'Course')
            };
            this.store.find('parse-user', {where: JSON.stringify(where)})
                .then(function (results) {
                    this.get('courseSuggestedFollowing').clear();
                    results.removeObject(this.get('model'));
                    this.get('courseSuggestedFollowing').addObjects(results);
                    this.set('isGettingCourseSuggestedFollowing', false);
                }.bind(this));
        }.observes('course.id'),

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
            coverImageStyle: null,
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

            courseSelected: function (course) {
                this.set('selectedCourse', course);
                /*
                 * Try to determine course length based on name
                 * But we'll allow users to manually change it
                 */
                if (course.concentration[0].name === "Medicine" ||
                    course.concentration[0].name === "Dentsitry")
                    this.set('selectedCourse.courseLength', 5);
                else if (course.concentration[0].name === "law")
                    this.set('selectedCourse.courseLength', 4);
                else
                    this.set('selectedCourse.courseLength', 3);


                var graduationYear = parseInt(course.year.name),
                    currentCalendarYear = new Date().getFullYear(),
                    currentYearInCourse;

                /*
                 * Try to determine current year of study based on:
                 * - graduation year
                 * - length of course
                 * - current calendar year
                 */

                if (graduationYear > currentCalendarYear) {
                    var yearsLeftToGraduate = graduationYear - currentCalendarYear;
                    currentYearInCourse = this.get('selectedCourse.courseLength') - yearsLeftToGraduate;
                } else {
                    currentYearInCourse = this.get('selectedCourse.courseLength');
                }
                if (currentYearInCourse < 0)
                    currentYearInCourse = 1;

                this.set('selectedCourse.currentYear', currentYearInCourse);
            },

            saveCourseChanges: function (education, isFacebook) {
                this.send('incrementLoadingItems');
                this.send('closeModal');
                /*
                 * If the education object is from facebook,
                 * change the properties to match our structure
                 */
                if (isFacebook) {
                    education.institutionName = education.school.name;
                    education.institutionFacebookId = education.school.id;
                    education.courseName = education.concentration[0].name;
                    education.courseFacebookId = education.concentration[0].id;
                    education.yearNumber = education.currentYear;
                }
                Parse.Cloud.run('updateUserEducation', {userId: this.get('currentUser.id'), education: education},
                    {
                        success: function (response) {
                            this.get('currentUser').set('yearNumber', education.yearNumber);
                            this.store.findById('university', response.university.id)
                                .then(function (university) {
                                    this.get('currentUser').set('institution', university);
                                    return this.store.findById('course', response.course.id);
                                }.bind(this)).then(function (course) {
                                    this.get('currentUser').set('course', course);
                                    this.send('decrementLoadingItems');
                                }.bind(this));
                        }.bind(this),

                        error: function (error) {
                            console.log("Error");
                            console.dir(error);
                            this.send('decrementLoadingItems');
                        }
                    });
            },

            clearAutocompleteList: function () {
                this.get('autocompleteInstitutionNames').clear();
                this.get('autocompleteCourseNames').clear();
            },

            followAllFacebookFriends: function () {
                this.send('bulkFollow', this.get('facebookFriendsOnMyCQs'));
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
            if (this.get('isCurrentUser') && !this.get('finishedWelcomeTutorial')) {
                this.set('finishedWelcomeTutorial', true);
                this.get('model').save();
                this.send('addNotification', 'welcome', 'Welcome to MyCQs!', "This is your new profile page!");
                var confirm = {
                    controller: this,
                    callbackAction: 'welcomePersonaliseNow',
                    positive: "Personalise now",
                    negative: "Later"
                };
                this.send('addNotification', 'profile', 'Would you like to personalise it now?', "", confirm);
            }
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
