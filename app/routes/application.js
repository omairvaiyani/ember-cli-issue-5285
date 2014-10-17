import
Ember
from
'ember';

import
FormValidation
from
'../utils/form-validation';

import
ParseHelper
from
'../utils/parse-helper';

import
Constants
from
'../utils/constants';

export default
Ember.Route.extend({
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
        if(!this.get('applicationController.currentUser'))
            return;
        var currentUser = this.get('applicationController.currentUser');
        amplitude.setUserId(currentUser.get('id'));
        var userProperties = {};
        userProperties.name = currentUser.get('name');
        userProperties.slug = currentUser.get('slug');
        userProperties.university = currentUser.get('university.name');
        userProperties.course = currentUser.get('course.name');
        userProperties.year = currentUser.get('yearNumber');
        userProperties.fbid = currentUser.get('fbid');
        userProperties.numberOfTests = currentUser.get('numberOfTests');
        userProperties.numberOfAttempts = currentUser.get('numberOfAttempts');
        amplitude.setUserProperties(userProperties);
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
         * for AJAX HTML snapshort crawling
         * If not called, page will take 20
         * seconds to load fully.
         */
        prerenderReady: function () {
            window.prerenderReady = true;
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
            if (title.indexOf("MyCQs") === -1)
                this.set('pageTitle', title + " - MyCQs");
            else
                this.set('pageTitle', title);
            this.send('closeModal');
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

                for (var i=0; i<metas.length; i++) {
                    if (metas[i].getAttribute("name") === "description") {
                        metaDescription = metas[i];
                    }
                }
                metaDescription.content = description;
            });
        },

        signUp: function () {
            var name = this.controllerFor('application').get('newUser.name'),
                email = this.controllerFor('application').get('newUser.email'),
                password = this.controllerFor('application').get('newUser.password'),
                confirmPassword = this.controllerFor('application').get('newUser.confirmPassword'),
                errors = false;

            if (!FormValidation.name(name.trim())) {
                this.controllerFor('application').set('signUpValidationErrors.name', true);
                errors = true;
            }
            if (!FormValidation.email(email.trim())) {
                this.controllerFor('application').set('signUpValidationErrors.email', true);
                errors = true;
            }
            if (!FormValidation.password(password)) {
                this.controllerFor('application').set('signUpValidationErrors.password', true);
                errors = true;
            }
            if (!FormValidation.confirmPassword(password, confirmPassword)) {
                this.controllerFor('application').set('signUpValidationErrors.confirmPassword', true);
                errors = true;
            }
            if (!errors) {
                this.send('incrementLoadingItems');
                Parse.Cloud.run('preSignUp', {"email": email.trim()}, {
                    success: function (response) {
                        var privateData = response.privateData,
                            username = response.privateData.get('username');
                        this.send('closeModal');
                        var data = {
                                name: name.trim(),
                                username: username,
                                signUpSource: 'Web',
                                privateData: ParseHelper.generatePointerFromNativeParse(privateData),
                                password: password
                            },
                            ParseUser = this.store.modelFor('parse-user');
                        ParseUser.signup(this.store, data).then(
                            function (userMinimal) {
                                userMinimal.set('name', name);
                                this.set('applicationController.currentUser', userMinimal);
                                this.send('redirectAfterLogin');
                                this.send('decrementLoadingItems');
                            }.bind(this),
                            function (error) {
                                console.log("Error with ParseUser.signup() in: " + "signUpWithEmail");
                                console.dir(error);
                                this.send('decrementLoadingItems');
                            }.bind(this)
                        );

                    }.bind(this),

                    error: function (error) {
                        console.log("Error!");
                        console.dir(error);
                        if(error.message == Parse.Error.EMAIL_TAKEN)
                            this.send('addNotification', 'warning', 'Email Taken', 'This email has already been taken!');
                        this.send('decrementLoadingItems');
                    }.bind(this)
                });
            }
        },
        login: function () {
            this.send('incrementLoadingItems');

            var controller = this.controllerFor('application'),
                email = controller.get('loginUser.email'),
                password = controller.get('loginUser.password'),
                ParseUser = this.store.modelFor('parse-user'),
                data;

            controller.set('loginMessage.connecting', "Logging in...");

            Parse.Cloud.run('preLogIn', {"email": email}, {
                success: function (response) {
                    data = {
                        username: response.username,
                        password: password
                    };
                    ParseUser.login(this.store, data).then(
                        function (user) {
                            controller.set('currentUser', user);
                            controller.set('loginMessage.connecting', null);
                            this.send('decrementLoadingItems');
                            this.send('closeModal');
                            this.send('redirectAfterLogin');
                        }.bind(this),

                        function (error) {
                            this.send('decrementLoadingItems');
                            console.dir(error);
                            if (error.code === Parse.Error.OBJECT_NOT_FOUND)
                                controller.set('loginMessage.error', "Incorrect credentials!");
                            else if (error.code === Parse.Error.EMAIL_MISSING)
                                controller.set('loginMessage.error', "Please type in your email!");
                            else if (error.code === Parse.Error.PASSWORD_MISSING)
                                controller.set('loginMessage.error', "Please type in your password!");
                            else
                                controller.set('loginMessage.error', "Error " + error.code);
                            controller.set('loginMessage.connecting', null);
                        }.bind(this)
                    );
                }.bind(this),
                error: function (error) {
                    console.dir(error);
                    this.send('decrementLoadingItems');
                    if (error.message == Parse.Error.EMAIL_NOT_FOUND)
                        controller.set('loginMessage.error', "Email not found!");
                    else if (error.message == Parse.Error.EMAIL_MISSING)
                        controller.set('loginMessage.error', "Please type in your email!");
                    else
                        controller.set('loginMessage.error', "Error " + error.code);
                    controller.set('loginMessage.connecting', null);
                }.bind(this)
            });

        },
        /**
         * Facebook Connect:
         * - getLoginStatus checks if the fb user is already connected with our app
         * -- if response === 'connected', it will have auth data to continue
         * -- if response !== 'connected', we make a FB.login call to get the user to connect.
         * - Once 'connected', we call the next method in the chain 'signUpAuthorisedFacebookUser'
         */
        facebookConnect: function () {
            FB.login(function(response) {
                if (response.authResponse) {
                    this.send('signUpAuthorisedFacebookUser', response.authResponse);
                }
            }.bind(this), {scope: 'public_profile, user_friends, friends_about_me, user_about_me, ' +
                'email, user_location, user_education_history, friends_education_history'});

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
                var ParseUser = this.store.modelFor('parse-user'),
                    data = {
                        username: response.id,
                        name: response.name,
                        fbid: response.id,
                        gender: response.gender,
                        education: response.education,
                        coverImageURL: response.cover.source,
                        facebookFriends: fbFriendsArray,
                        authData: {
                            facebook: {
                                access_token: authResponse.accessToken,
                                id: authResponse.userID,
                                expiration_date: (new Date(2032, 2, 2))
                                //expiration_date: authResponse.expiresIn
                            }
                        }
                    };
                Parse.Cloud.run('preFacebookConnect', {authResponse: authResponse},
                    {
                        success: function () {
                            ParseUser.signup(this.store, data).then(
                                function (user) {
                                    this.send('decrementLoadingItems');
                                    /*
                                     * Sometimes user info is missing,
                                     * let's add some of it here:
                                     */
                                    if (!user.get('slug.length')) {
                                        var sessionToken = user.get('sessionToken');
                                        /*
                                         * New user's dont have all
                                         * info set. Must do second
                                         * query to find fresh
                                         * and avoid Ember caching.
                                         * Also, must reset sessionToken!
                                         */
                                        this.send('incrementLoadingItems');
                                        var where = {
                                            objectId: user.get('id')
                                        };
                                        this.store.findQuery('parse-user', {where: JSON.stringify(where)})
                                            .then(function (results) {
                                                var user = results.objectAt(0);
                                                /*
                                                 * Update FB Friends list everytime
                                                 */
                                                user.set('sessionToken', sessionToken);
                                                user.set('facebookFriends', fbFriendsArray);
                                                this.controllerFor('application').set('currentUser', user);
                                                this.send('redirectAfterLogin');
                                                this.send('decrementLoadingItems');
                                            }.bind(this));
                                    } else {
                                        /*
                                         * Update FB Friends list everytime
                                         */
                                        user.set('facebookFriends', fbFriendsArray);
                                        this.controllerFor('application').set('currentUser', user);
                                        this.send('redirectAfterLogin');
                                    }
                                }.bind(this),
                                function (error) {
                                    this.send('decrementLoadingItems');
                                    console.log("Error with ParseUser.signup() in: " + "signUpAuthorisedFacebookUser");
                                    console.dir(error);
                                }.bind(this)
                            );

                        }.bind(this),
                        error: function (error) {
                            if (this.get('applicationController').get('loadingItems'))
                                this.get('applicationController').decrementProperty('loadingItems');
                            console.log('signUpAuthorisedFacebookUser error: ' + this.get('applicationController').get('loadingItems'));
                            console.log(JSON.stringify(error));
                        }
                    });

            }.bind(this));
        },

        logout: function () {
            this.get('applicationController').set('currentUser', null);
            this.transitionTo('index');
        },

        forgotPassword: function () {
            var controller = this.controllerFor('application'),
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
                success: function (response) {
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
                this.controllerFor(this.get('applicationController.redirectAfterLoginToRoute')).send('returnedFromRedirect');
                this.set('applicationController.redirectAfterLoginToRoute', null);
            }
            else if (!this.get('currentUser.finishedWelcomeTutorial')) {
                /*
                 * First time logging into this site
                 */
                if (this.get('currentUser.slug'))
                    this.transitionTo('user', this.get('currentUser.slug'));
                else {
                    this.transitionTo('user', this.get('currentUser'));
                }

            } else
                this.transitionTo('index');
        },

        openModal: function (modalName, controller, model) {
            var myModal = jQuery('#myModal');

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
            Parse.Cloud.run('unfollowUser', { userIdToUnfollow: user.get('id')},
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

        bulkFollow: function (users) {
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

            Parse.Cloud.run('bulkFollowUsers',
                {
                    userIdsToFollow: userIdsToFollow
                }, {
                    success: function (response) {
                    }.bind(this),
                    error: function (error) {
                        console.log("There was an error: " + error);
                    }.bind(this)
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
                            recipientId: this.get('currentUser.id'),
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
         * Action handler for creating a new notification.
         * Could be called from elsewhere throughout the application.
         * @param type {String} classification; used for which icon to show
         * @param title {String} leading text
         * @param message {String} supporting text
         * @param confirm {Object} controller, callbackAction, positive, negative
         */
        addNotification: function (type, title, message, confirm) {
            var notification = Ember.Object.create({
                type: type,
                title: title,
                message: message,
                confirm: confirm,
                closed: false
            });
            this.get('applicationController.notifications').pushObject(notification);
        },

        /**
         * Analytics action for events
         * @param event {String} e.g. Test created
         * @param object {Object} (optional) e.g. Test
         */
        recordEvent: function (event, object) {
            /*
             * Amplitude
             */
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
        }

    }
});
