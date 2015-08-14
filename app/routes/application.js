import Ember from 'ember';
import FormValidation from '../utils/form-validation';
import ParseHelper from '../utils/parse-helper';
import Constants from '../utils/constants';
import EventTracker from '../utils/event-tracker';

export default Ember.Route.extend({
    applicationController: null,

    currentUser: function () {
        if (this.get('applicationController')) {
            return this.get('applicationController.currentUser');
        }
    }.property('applicationController.currentUser.id'),

    /**
     * Convenience observer as Controller loads before Route
     * can handle actions.
     * Sets user properties on analytics
     */
    initializeCurrentUserOnAnalytics: function () {
        if (!this.get('applicationController.currentUser'))
            return;
        var currentUser = this.get('applicationController.currentUser');
        //amplitude.setUserId(currentUser.get('id'));
        var userProperties = {};
        userProperties.name = currentUser.get('name');
        userProperties.slug = currentUser.get('slug');
        userProperties.university = currentUser.get('university.name');
        userProperties.course = currentUser.get('course.name');
        userProperties.year = currentUser.get('yearNumber');
        userProperties.fbid = currentUser.get('fbid');
        userProperties.numberOfTests = currentUser.get('numberOfTests');
        userProperties.numberOfAttempts = currentUser.get('numberOfAttempts');
        //amplitude.setUserProperties(userProperties);
    }.observes('applicationController.currentUser.id'),

    setupController: function (controller, model) {
        controller.set('model', model);
        this.set('applicationController', controller);
        controller.notifyPropertyChange('currentUser');
    },

    pageTitle: '',

    pageTitleMessageCounter: function () {
        if (!this.get('currentUser.totalUnreadMessages'))
            return "";
        else
            return "(" + this.get('currentUser.totalUnreadMessages') + ") ";
    }.property('currentUser.totalUnreadMessages.length'),

    setFullPageTitle: function () {
        window.document.title = this.get('pageTitleMessageCounter') + this.get('pageTitle');
    }.observes('pageTitle.length', 'pageTitleMessageCounter.length'),

    serverStatusMeta: null,

    allowPasswordResetRequest: true,

    actions: {
        /*
         * Update server status code for Prerender crawling
         */
        updateStatusCode: function (code) {
            var meta = this.get('serverStatusMeta');
            if (!meta) {
                meta = document.createElement('meta');
                meta.name = "prerender-status-code";
                meta.content = code;
                document.getElementsByTagName('head')[0].appendChild(meta);
                this.set('serverStatusMeta', meta);
            }
            meta.content = code;
        },

        /*
         * Set Prerender variable to true
         * for AJAX HTML snapshot crawling
         * If not called, page will take 20
         * seconds to load fully.
         */
        prerenderReady: function () {
            window.prerenderReady = true;
            setTimeout(function () {
                // This avoids recording this event when being crawled by FB.
                if (!this.get('hasRecordedEventWebsiteOpened')) {
                    EventTracker.recordEvent(EventTracker.WEBSITE_OPENED);
                    this.set('hasRecordedEventWebsiteOpened', true);
                }
            }.bind(this), 1500);
        },

        /*
         * Receives from ApplicationController.currentPathDidChange.
         * Also called when currentUser.totalUnreadMessages changes.
         * Sometimes from individual routes, e.g. TestRoute:
         * - Actual title sent from TestRoute
         * - Empty title sent from ApplicationController when
         * -- message counter changes
         * Close any open modal.
         */
        updatePageTitle: function (title) {
            if (title.indexOf("Synap") === -1)
                this.set('pageTitle', title + " - Synap");
            else
                this.set('pageTitle', title);
        },

        /*
         * Default description is set at first
         * Certain pages, i.e. tests, browse will
         * have custom descriptions.
         */
        updatePageDescription: function (description) {
            $(function () { // dom ready
                var metas = document.getElementsByTagName('meta'),
                    metaDescription;

                for (var i = 0; i < metas.length; i++) {
                    if (metas[i].getAttribute("name") === "description") {
                        metaDescription = metas[i];
                    }
                }
                metaDescription.content = description;
            });
        },

        /*
         * This action allows the user to press
         * 'enter/return' whilst entering their
         * form data, and still trigger the
         * async-button component to display
         * promise state changes.
         */
        submitSignUp: function () {
            var signUpButton = Ember.$("#sign-up-button");
            if (signUpButton[0])
                signUpButton.trigger("click");
            else
                this.send('signUp');
        },

        signUp: function (callback) {
            var applicationController = this.get('applicationController'),
                name = applicationController.get('newUser.name'),
                email = applicationController.get('newUser.email'),
                password = applicationController.get('newUser.password');

            applicationController.set('signUpValidationErrors.name', FormValidation.name(name.trim()));
            applicationController.set('signUpValidationErrors.email', FormValidation.email(email.trim()));
            applicationController.set('signUpValidationErrors.password', FormValidation.password(password.trim()));
            if (!applicationController.get('signUpValidationHasErrors')) {
                var data = {
                    name: name.capitalize().trim(),
                    username: email.trim(),
                    email: email.trim(),
                    signUpSource: 'Web',
                    password: password
                };
                this.send('registerUser', data, callback);
            } else if (callback) {
                callback(new Parse.Promise().resolve());
            }
        },

        login: function (callback) {
            this.send('incrementLoadingItems');

            var controller = this.controllerFor('application');

            var email = controller.get('loginUser.email'),
                password = controller.get('loginUser.password'),
                ParseUser = this.store.modelFor('parse-user'),
                data = {
                    username: email,
                    password: password
                };

            var promise = ParseUser.login(this.store, data)
                .then(
                function (user) {
                    controller.set('currentUser', user);
                    this.send('closeModal');
                    this.send('redirectAfterLogin');
                }.bind(this),

                function (error) {
                    console.dir(error);
                    if (error.code === Parse.Error.OBJECT_NOT_FOUND)
                        controller.set('loginMessage.error', "Email and password do not match");
                    else if (error.code === Parse.Error.EMAIL_MISSING)
                        controller.set('loginMessage.error', "Please type in your email");
                    else if (error.code === Parse.Error.PASSWORD_MISSING)
                        controller.set('loginMessage.error', "Please type in your password");
                    else if (error.error)
                        controller.set('loginMessage.error', error.error.capitalize());
                    else
                        controller.set('loginMessage.error', "Something went wrong! " + error.code);
                }.bind(this)).then(function () {
                    this.send('decrementLoadingItems');
                }.bind(this));

            if (callback)
                callback(promise);
        },

        /**
         * Facebook Connect:
         * - getLoginStatus checks if the fb user is already connected with our app
         * -- if response === 'connected', it will have auth data to continue
         * -- if response !== 'connected', we make a FB.login call to get the user to connect.
         * - Once 'connected', we call the next method in the chain 'signUpAuthorisedFacebookUser'
         */
        facebookConnect: function () {
            FB.login(function (response) {
                if (response.authResponse) {
                    this.send('signUpAuthorisedFacebookUser', response.authResponse);
                }
            }.bind(this), {
                scope: 'public_profile, user_friends, user_about_me, user_education_history,' +
                'email, user_location'
            });

        },
        /**
         * Sign up Authorised Facebook User:
         * - Contrary to the name of this method and the use of ParseUser.signup,
         * this method is used for both logging in and signing up new facebook users
         * to our back-end.
         * - First, use the auth data from the facebookConnect method to make a graph
         * api call
         * - Convert the facebook user object data to our relevant ParseUser attributes
         * - Sign up will act as a login or sign up method depending on whether the
         * username (fb.email) was found
         * - userMinimal is the object returned form the back-end, to get the whole
         * user object, we make a findUserById('user') request to the back-end
         * - Once a fully loaded user record is received, progress to controller logic.
         */
        signUpAuthorisedFacebookUser: function (authResponse) {
            this.get('applicationController').incrementProperty('loadingItems');
            this.send('closeModal');
            FB.api('/me', {fields: 'name,education,gender,cover,email,friends'}, function (response) {
                if (!response.cover)
                    response.cover = {source: null};
                if (!response.friends)
                    response.friends = {data: []};

                var fbFriendsArray = [],
                    fbFriendsData = response.friends.data;
                for (var i = 0; i < fbFriendsData.length; i++) {
                    fbFriendsArray.push(fbFriendsData[i].id);
                }
                var data = {
                    username: response.email,
                    email: response.email,
                    name: response.name,
                    fbid: response.id,
                    gender: response.gender,
                    fbEducation: response.education,
                    fbCoverPicture: response.cover,
                    fbFriends: fbFriendsArray,
                    signUpSource: "Web",
                    authData: {
                        facebook: {
                            access_token: authResponse.accessToken,
                            id: authResponse.userID,
                            expiration_date: (new Date(2032, 2, 2))
                        }
                    }
                };
                this.send('registerUser', data);
            }.bind(this));

        },

        /**
         * @Function Register User
         * Brings together the Facebook and Email
         * sign up flows.
         * @param {Object} data
         * @param {Function} callback
         */
        registerUser: function (data, callback) {
            var ParseUser = this.store.modelFor('parse-user'),
                timeZone = jstz().timezone_name;

            data.timeZone = timeZone;

            var promise = ParseUser.signup(this.store, data).then(function (user) {
                this.get('applicationController').set('currentUser', user);
                return user.reload();
            }.bind(this)).then(function () {
                    if (this.get('applicationController.currentUser.firstTimeLogin')) {
                        this.set('applicationController.currentUser.firstTimeLogin', false);
                        this.set('applicationController.redirectAfterLoginToRoute', 'join.personalise');
                        this.set('applicationController.redirectAfterLoginToController', 'join');
                    }
                    this.send('redirectAfterLogin');
                }.bind(this),
                function (error) {
                    console.log("Error with ParseUser.signup() in: registerUser");
                    console.dir(error);

                    if (error.code === Parse.Error.USERNAME_TAKEN || error.code === Parse.Error.EMAIL_TAKEN)
                        this.get('applicationController').set('signUpValidationErrors.email', "Email taken.");
                    else if (error.error)
                        this.get('applicationController').set('signUpValidationErrors.signUp', error.error.capitalize());
                    else
                        this.get('applicationController').set('signUpValidationErrors.signUp', "Something went wrong!");
                }.bind(this)).then(function () {
                    this.send('decrementLoadingItems');
                }.bind(this));

            if (callback)
                callback(promise);
        },

        logout: function () {
            this.get('applicationController').set('currentUser', null);
            this.transitionTo('index');
            window.location.reload();
        },

        forgotPassword: function () {
            var controller = this.get('applicationController'),
                email = controller.get('loginUser.email');

            if (!email) {
                controller.set('loginMessage.error', "Enter email first.");
                return;
            } else if (!this.get('allowPasswordResetRequest')) {
                controller.set('loginMessage.error', "Reset link already sent!");
                return;
            }

            controller.set('loginMessage.connecting', "Sending request...");

            Parse.Cloud.run('resetPasswordRequest', {email: email}, {
                success: function () {
                    controller.set('loginMessage.connecting', "Reset email sent!");
                    this.set('allowPasswordResetRequest', false);
                    setTimeout(function () {
                        controller.set('loginMessage.connecting', "Check your email inbox.");
                    }.bind(this), 2000);
                    setTimeout(function () {
                        this.set('allowPasswordResetRequest', true);
                    }.bind(this), 60000);
                }.bind(this),
                error: function (error) {
                    console.dir(error);
                    if (error.message == Parse.Error.EMAIL_NOT_FOUND)
                        controller.set('loginMessage.error', "Email not found!");
                    else
                        controller.set('loginMessage.error', "Error " + error.code);
                }.bind(this)
            });
        },

        redirectAfterLogin: function () {
            if (this.get('applicationController.redirectAfterLoginToRoute')) {
                this.transitionTo(this.get('applicationController.redirectAfterLoginToRoute'));
                if (this.get('applicationController.redirectAfterLoginToController'))
                    this.controllerFor(this.get('applicationController.redirectAfterLoginToController'))
                        .send('returnedFromRedirect');
                else
                    this.controllerFor(this.get('applicationController.redirectAfterLoginToRoute'))
                        .send('returnedFromRedirect');
                this.set('applicationController.redirectAfterLoginToRoute', null);
            } else
                this.transitionTo('index');
        },

        /**
         * Open Modal
         * - Must supply modalName.
         * - No controller or controller set as true
         *      to resolve modalName to controller path.
         * - Model can be anything, if no controller is
         *   supplied, model can be second param.
         *
         *  @param {String} modalName (Template)
         * @param {String} controller (Name)
         * @param {Object} model
         * @returns {*}
         */
        openModal: function (modalName, controller, model) {
            var myModal = jQuery('#myModal');

            if (controller === true)
                controller = modalName;

            if (model)
                this.controllerFor(controller).set('model', model);

            this.render(modalName, {
                into: 'application',
                outlet: 'modal',
                controller: controller
            });

            return myModal.modal('show');
        },

        closeModal: function () {
            $('#myModal').modal('hide');
            return this.disconnectOutlet({
                outlet: 'modal',
                parentView: 'application'
            });
        },

        followUser: function (user) {
            var currentUser = this.get('currentUser');
            currentUser.incrementProperty('numberFollowing');
            user.incrementProperty('numberOfFollowers');
            currentUser.get('following').pushObject(user);
            if (user.get('followers'))
                user.get('followers').pushObject(currentUser);

            Parse.Cloud.run('followUser',
                {
                    userIdToFollow: user.get('id')
                }, {
                    success: function (response) {
                    }.bind(this),
                    error: function (error) {
                        console.log("There was an error: " + error);
                        currentUser.decrementProperty('numberFollowing');
                        user.decrementProperty('numberOfFollowers');
                        if (user.get('followers'))
                            user.get('followers').removeObject(currentUser);
                        currentUser.get('following').removeObject(user);
                    }.bind(this)
                });
        },

        unfollowUser: function (user) {
            var currentUser = this.get('currentUser');
            currentUser.decrementProperty('numberFollowing');
            user.decrementProperty('numberOfFollowers');
            currentUser.get('following').removeObject(user);
            if (user.get('followers'))
                user.get('followers').removeObject(currentUser);
            Parse.Cloud.run('unfollowUser', {userIdToUnfollow: user.get('id')},
                {
                    success: function (success) {
                    }.bind(this),
                    error: function (error) {
                        console.log("There was an error: " + error);
                        currentUser.incrementProperty('numberFollowing');
                        user.incrementProperty('numberOfFollowers');
                        if (user.get('followers'))
                            user.get('followers').pushObject(currentUser);
                        currentUser.get('following').pushObject(user);
                    }.bind(this)
                });
        },

        bulkFollow: function (users, callback) {
            var userIdsToFollow = [];
            if (!this.get('currentUser.following'))
                this.set('currentUser.following', Ember.A());

            users.forEach(function (user) {
                if (!this.get('currentUser.following').contains(user)) {
                    userIdsToFollow.push(user.get('id'));
                    this.get('currentUser.following').pushObject(user);
                    this.incrementProperty('currentUser.numberFollowing');
                    user.incrementProperty('numberOfFollowers');
                    if (!user.get('followers'))
                        user.set('followers', Ember.A());
                    user.get('followers').pushObject(this.get('currentUser'));
                }
            }.bind(this));

            var promise = Parse.Cloud.run('bulkFollowUsers', {
                userIdsToFollow: userIdsToFollow
            });
            if (callback)
                callback(promise);
            promise.then(function () {
            }.bind(this), function (error) {
                console.dir(error);
            });
        },

        incrementLoadingItems: function () {
            if (this.get('applicationController'))
                this.get('applicationController').incrementProperty('loadingItems');
        },

        decrementLoadingItems: function () {
            if (this.get('applicationController.loadingItems'))
                this.get('applicationController').decrementProperty('loadingItems');
        },

        sendPush: function (controller, type, sendObject) {
            switch (type) {
                case "toMobile":
                    controller.set('sendToMobileButtonText', "Sending...");
                    Parse.Cloud.run('sendPushToUser',
                        {
                            recipientUserId: this.get('currentUser.id'),
                            message: "Hey check out this test!",
                            testId: sendObject.get('id'),
                            type: "sendToMobile"
                        }, {
                            success: function (response) {
                                controller.set('sendToMobileButtonText', "Sent!");
                                setInterval(function () {
                                    controller.set('sendToMobileButtonText', "Send again");
                                }, 3000);
                            }.bind(this),
                            error: function (error) {
                                controller.set('sendToMobileButtonText', "Error, try again.");
                                setInterval(function () {
                                    controller.set('sendToMobileButtonText', "Send again");
                                }, 3000);
                                console.log("There was an error: " + error);
                            }.bind(this)
                        });
                    break;
            }
        },

        /**
         * @Action Add Notification
         *
         * Action handler for creating a new notification.
         * Could be called from elsewhere throughout the application.
         *
         * @param {Object} notificationObject
         * {
         *       type {String} classification; used for which icon to show
         *       title {String} leading text
         *       message {String} supporting text
         *       confirm {Object} {controller, callbackAction, positive, negative, returnItem}
         *       undo {Object} {controller, callbackAction, returnItem}
         *  }
         *  Examples:
         *  // Standard
         *  {type: "success", title:"Question added!", message:"You now have 4 questions."}
         *  `No response`
         *
         *  // Confirm
         *  {type: "delete", title:"Are you sure you?", message:"",
         *      confirm: {controller: this, callbackAction: "deleteObject", positive: "DELETE",
         *      negative: "CANCEL", returnItem: test}}
         *  callbackAction `True | False, returnItem`
         *
         *  // Undo (finalAction is called if User does NOT press undo)
         *   {type: "delete", title:"Test deleted.", message:"Cardiology Test.",
         *      undo: {controller: this, finalAction: "deleteObject", returnItem: test}}
         *  callbackAction `True | False, returnItem` <-- True means UNDO CHANGES
         *
         */
        addNotification: function (notificationObject) {
            if (typeof notificationObject !== "object")
                return console.dir("ERROR, notification requires object - " + JSON.stringify(arguments));

            var notification = Ember.Object.create(notificationObject);

            this.get('applicationController.notifications').pushObject(notification);
        },

        newUserEvent: function (payload) {
            if (!payload.userEvent)
                return;
            var userEvent = ParseHelper.extractRawPayload(this.store, 'user-event', payload.userEvent);
            this.get('currentUser').reload().then(function () {
                var notification = {
                    type: "points",
                    title: '+' + userEvent.get('pointsTransacted') + "XP | " + userEvent.get('label'),
                    message: "Total: " + this.get('currentUser.points') +
                    "xp / " + this.get('currentUser.level.title')
                };
                this.send('addNotification', notification);
            }.bind(this));
        },

        activateSiteSearch: function () {
            this.set('preSearchRoute', this.get('applicationController.currentPath'));
            this.transitionTo('search');
            this.controllerFor('application').set('inSearchMode', true);
            setTimeout(function () {
                Ember.$('#site-search-input').focus();
            }, 500);
        },

        deactivateSiteSearch: function () {
            if (this.get('applicationController.currentPath') === 'search') {
                if (this.get('preSearchRoute'))
                    this.transitionTo(this.get('preSearchRoute'));
                else
                    this.transitionTo('index');
            }
            this.controllerFor('application').set('inSearchMode', false);
        },

        /**
         * @Action Save Community Test
         *
         * Called from TestCardComponent
         * Allows current user to save a
         * community test to their savedTests
         * list.
         *
         * @param test
         */
        saveCommunityTest: function (test) {
            this.get('currentUser.savedTests').addObject(test);
            var params = {
                "parentObjectClass": "_User",
                "parentObjectId": this.get('currentUser.id'),
                "relationKey": "savedTests",
                "childObjectClass": "Test",
                "childObjectIds": [test.id],
                "isTaskToAdd": true
            };
            ParseHelper.cloudFunction(this, 'addOrRemoveRelation', params)
                .then(function (response) {
                }, function (error) {
                    console.dir(error);
                });
        },

        /**
         * @Action Remove Community Test
         *
         * Called from TestCardComponent
         * Allows current user to remove a
         * community test from their savedTests
         * list.
         *
         * @param test
         */
        removeCommunityTest: function (test) {
            this.get('currentUser.savedTests').removeObject(test);
            var params = {
                "parentObjectClass": "_User",
                "parentObjectId": this.get('currentUser.id'),
                "relationKey": "savedTests",
                "childObjectClass": "Test",
                "childObjectIds": [test.id],
                "isTaskToAdd": false
            };
            ParseHelper.cloudFunction(this, 'addOrRemoveRelation', params)
                .then(function (response) {
                }, function (error) {
                    console.dir(error);
                });
        },

        /**
         * @DEPRECATED (Use utils/event-tracker.recordEvent)
         * Analytics action for events
         * @param event {String} e.g. Test created
         * @param object {Object} (optional) e.g. Test
         */
        recordEvent: function (event, object) {
            /*
             * Amplitude
             */
            /*
             if (!object)
             amplitude.logEvent(event);
             else {
             var eventData;
             switch (event) {
             case Constants.TEST_CREATED:
             eventData = {
             title: object.get('title'),
             category: object.get('category.name')
             };
             break;
             case Constants.TEST_TAKEN:
             eventData = {
             title: object.get('title'),
             category: object.get('category.name'),
             score: object.get('score')
             };
             break;
             }
             amplitude.logEvent(event, eventData);
             }
             */
        }


    }
});
