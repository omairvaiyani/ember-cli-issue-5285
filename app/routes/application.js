import
Ember
from
'ember';

export default
Ember.Route.extend({
    actions: {
        login: function (email, password) {
            var controller = this.controllerFor('application'),
                ParseUser = this.store.modelFor('parse-user'),
                data = {
                    username: email,
                    password: password
                };
            controller.set('loginMessage.connecting', "Logging in...");
            ParseUser.login(this.store, data).then(
                function (user) {
                    controller.set('currentUser', user);
                    controller.set('loginMessage.connecting', "");
                },
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
            FB.api('/me', {fields: 'name,education,gender,cover,email,friends'}, function (response) {
                console.dir(response);
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
                ParseUser.signup(this.store, data).then(
                    function (userMinimal) {
                        /*
                         * Need to temporarily reasign all the values to this user object
                         * Parse annoyingly does not send all the user info
                         * If we do a second .find() query, ember-data just uses the cache version
                         */
                        userMinimal.set('name', response.name);
                        userMinimal.set('fbid', response.id);
                        userMinimal.set('email', response.email);
                        userMinimal.set('gender', response.gender);
                        userMinimal.set('coverImageURL', response.cover.source);
                        userMinimal.set('facebookFriends', fbFriendsArray);
                        this.controllerFor('application').set('currentUser', userMinimal);
                        this.send('closeModal');
                        this.transitionTo('user', userMinimal);
                    }.bind(this),
                    function (error) {
                        console.log("Error with ParseUser.signup() in: " + "signUpAuthorisedFacebookUser");
                        console.dir(error);
                    }
                );
            }.bind(this));
        },

        logout: function () {
            this.controllerFor('application').set('currentUser', null);
            this.transitionTo('index');
            this.refresh();
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
        }
    }
});
