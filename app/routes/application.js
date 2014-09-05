import
Ember
from
'ember';

import
FormValidation
from
'../utils/form-validation';

export default
Ember.Route.extend({
    applicationController: null,

    currentUser: function () {
        if (this.get('applicationController'))
            return this.get('applicationController.currentUser');
    }.property('applicationController.currentUser.id'),

    setupController: function (controller, model) {
        controller.set('model', model);
        this.set('applicationController', controller);
        controller.notifyPropertyChange('currentUser');
    },

    actions: {
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
                var data = {
                        name: name.trim(),
                        email: email.trim(),
                        username: email.trim(),
                        password: password
                    },
                    ParseUser = this.store.modelFor('parse-user');

                ParseUser.signup(this.store, data).then(
                    function (userMinimal) {
                        userMinimal.set('name', name);
                        userMinimal.set('email', email);
                        console.log("Successfull registered");
                        console.dir(userMinimal);
                    }.bind(this),
                    function (error) {
                        console.log("Error with ParseUser.signup() in: " + "signUpWithEmail");
                        console.dir(error);
                    }
                );
            }
        },
        login: function () {
            var controller = this.controllerFor('application'),
                email = controller.get('loginUser.email'),
                password = controller.get('loginUser.password'),
                ParseUser = this.store.modelFor('parse-user'),
                data = {
                    username: email,
                    password: password
                };
            controller.set('loginMessage.connecting', "Logging in...");
            ParseUser.login(this.store, data).then(
                function (user) {
                    console.log("successfuly logged in");
                    controller.set('currentUser', user);
                    controller.set('loginMessage.connecting', "");
                    this.send('closeModal');
                    this.transitionTo('index');
                }.bind(this),
                function (error) {
                    console.dir(error);
                    if (error.code === 101)
                        controller.set('loginMessage.error', "Invalid email and password combination!");
                    if (error.code === 200)
                        controller.set('loginMessage.error', "Please type in your username or email!");
                    controller.set('loginMessage.connecting', "");
                }
            );
        },
        /**
         * Facebook Connect:
         * - getLoginStatus checks if the fb user is already connected with our app
         * -- if response === 'connected', it will have auth data to continue
         * -- if response !== 'connected', we make a FB.login call to get the user to connect.
         * - Once 'connected', we call the next method in the chain 'signUpAuthorisedFacebookUser'
         */
        facebookConnect: function () {
            FB.getLoginStatus(function (response) {
                if (response.status === 'connected') {
                    this.send('signUpAuthorisedFacebookUser', response.authResponse);
                }
                else {
                    FB.login(function (response) {
                        if (response.status === 'connected') {
                            // Logged into your app and Facebook.
                            this.send('signUpAuthorisedFacebookUser', response.authResponse);
                        } else if (response.status === 'not_authorized') {
                            // The person is logged into Facebook, but not your app.
                        } else {
                            // The person is not logged into Facebook, so we're not sure if
                            // they are logged into this app or not.
                        }
                    }.bind(this), {scope: 'public_profile,email,user_education_history,user_friends'});
                }
            }.bind(this));
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
            console.log("signUpAuthorisedFacebookUser called : "+this.get('applicationController').get('loadingItems'));
            this.send('closeModal');
            FB.api('/me', {fields: 'name,education,gender,cover,email,friends'}, function (response) {
                var fbFriendsArray = [],
                    fbFriendsData = response.friends.data;
                for (var i = 0; i < fbFriendsData.length; i++) {
                    fbFriendsArray.push(fbFriendsData[i].id);
                }
                var ParseUser = this.store.modelFor('parse-user'),
                    data = {
                        username: response.email,
                        email: response.email,
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
                /*
                 * TODO
                 * Need to initialize the Parse SDK on adapters/application.js
                 * before running this code. Normally we make an ember-data
                 * call by this point whereby the adapter is initialized,
                 * however, in this scenario, this happens to be the first
                 * api query and so parse is not initialized!
                 */
                Parse.Cloud.run('preFacebookConnect', {authResponse: authResponse},
                    {
                        success: function () {
                            ParseUser.signup(this.store, data).then(
                                function (user) {
                                    /*
                                     * Sometimes user info is missing,
                                     * let's add some of it here:
                                     */
                                    if (!user.get('name'))
                                        user.set('name', response.name);
                                    if (!user.get('fbid'))
                                        user.set('fbid', response.id);
                                    if (!user.get('email'))
                                        user.set('email', response.email);
                                    if (!user.get('coverImageURL'))
                                        user.set('coverImageURL', response.cover.source);

                                    /*
                                     * Update FB Friends list everytime
                                     */
                                    user.set('facebookFriends', fbFriendsArray);
                                    if(this.get('applicationController').get('loadingItems'))
                                        this.get('applicationController').decrementProperty('loadingItems');
                                    console.log('signUpAuthorisedFacebookUser ended: '+this.get('applicationController').get('loadingItems'));
                                    this.controllerFor('application').set('currentUser', user);
                                    this.transitionTo('index');
                                }.bind(this),
                                function (error) {
                                    console.log("Error with ParseUser.signup() in: " + "signUpAuthorisedFacebookUser");
                                    console.dir(error);
                                }
                            );

                        }.bind(this),
                        error: function (error) {
                            if(this.get('applicationController').get('loadingItems'))
                                this.get('applicationController').decrementProperty('loadingItems');
                            console.log('signUpAuthorisedFacebookUser error: '+this.get('applicationController').get('loadingItems'));
                            console.log(JSON.stringify(error));
                        }
                    });

            }.bind(this));
        },

        logout: function () {
            this.get('applicationController').set('currentUser', null);
            this.transitionTo('index');
        },
        openModal: function (modalName, controller) {
            var myModal = jQuery('#myModal');

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
                    mainUser: currentUser.get('id'),
                    userToFollow: user.get('id')
                }, {
                    success: function (success) {
                    }.bind(this),
                    error: function (error) {
                        console.log("There was an error: " + error);
                        currentUser.decrementProperty('numberFollowing');
                        user.decrementProperty('numberOfFollowers');
                        if (user.get('followers'))
                            user.get('followers').removeObject(currentUser);
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
            Parse.Cloud.run('unfollowUser',
                {
                    mainUser: currentUser.get('id'),
                    userToUnfollow: user.get('id')
                }, {
                    success: function (success) {
                    }.bind(this),
                    error: function (error) {
                        console.log("There was an error: " + error);
                        currentUser.incrementProperty('numberFollowing');
                        user.incrementProperty('numberOfFollowers');
                        if (user.get('followers'))
                            user.get('followers').pushObject(currentUser);
                    }.bind(this)
                });
        },

        incrementLoadingItems: function() {
            if(this.get('applicationController'))
                this.get('applicationController').incrementProperty('loadingItems');
        },

        decrementLoadingItems: function() {
            if(this.get('applicationController.loadingItems'))
                this.get('applicationController').decrementProperty('loadingItems');
        }
    }
});
