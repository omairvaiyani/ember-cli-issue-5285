import
Ember
from
'ember';

import
ParseHelper
from
'../utils/parse-helper';

export default
Ember.Controller.extend({
    needs: ['user', 'test', 'category'],

    /*
     * Observes for route transitions:
     * - Close modals if open
     * - Update website title
     */
    currentPathDidChange: function () {
        this.send('closeModal');

        var path = this.get('currentPath'),
            title;
        switch (path) {
            case "user.index":
                var user = this.get('controllers.user');
                title = user.get('name');
                break;
            case "user.tests":
                var user = this.get('controllers.user');
                title = user.get('name') + "'s tests";
                break;
            case "user.followers":
                var user = this.get('controllers.user');
                title = user.get('name') + "'s followers";
                break;
            case "user.following":
                var user = this.get('controllers.user');
                title = user.get('name') + "'s following";
                break;
            case "create":
                title = "Create a test";
                break;
            case "edit":
                title = "Test editor";
                break;
            case "browse":
                title = "Browse tests";
                break;
            case "category":
                var category = this.get('controllers.category');
                title = category.get('name');
                break;
            case "test":
                /*
                 * Handled in TestRoute.
                 */
                return;
            case "result":
                title = "Results";
                break;
            default:
                title = "DEFAULT";
                break;
        }
        this.send('updateTitle', title);
    }.observes('currentPath'),

    loadingItems: 0,

    currentUser: null,

    facebookAuth: null,

    facebookUserObject: function () {
        if (this.get('facebookAuth')) {
            FB.api('/me', function (response) {
                return response;
            });
        }
    }.property('facebookAuth'),

    loginUser: {
        email: '',
        password: ''
    },

    loginMessage: {
        error: '',
        connecting: ''
    },

    resetLoginMessage: function () {
        this.set('loginMessage.error', '');
        this.set('loginMessage.connection', '');
    }.observes('loginUser.email.length', 'loginUser.password.length'),

    manageCurrentUserSession: function () {
        var currentUser = this.get('currentUser');

        if (currentUser) {
            localStorage.sessionToken = currentUser.get('sessionToken');
        }
        else
            localStorage.clear();

    }.observes('currentUser'),

    /**
     * This hook gets the currentUser's
     * attempts, latestAttempts, followers and following
     * It is called on ApplicationRoute.setupController
     * as well as anytime the currentUser is changed.
     */
    initializeCurrentUser: function () {
        if (!this.get('currentUser')) {
            this.send('decrementLoadingItems');
            return;
        }
        this.send('incrementLoadingItems');
        var currentUser = this.get('currentUser'),
            arrayOfPromises = [];

        EmberParseAdapter.ParseUser.getFollowing(this.store, currentUser).then(function () {
                return EmberParseAdapter.ParseUser.getFollowers(this.store, currentUser);
            }.bind(this)).then(function () {
                return EmberParseAdapter.ParseUser.getMessages(this.store, currentUser);
            }.bind(this)).then(function () {
                this.send('decrementLoadingItems');
            }.bind(this));


        this.incrementProperty('loadingItems');
        currentUser.get('latestAttempts').then(function () {
                var where = {
                    "user": ParseHelper.generatePointer(currentUser)
                };
                return this.store.findQuery('attempt', {
                    where: JSON.stringify(where),
                    order: '-createdAt',
                    include: ['test.category', 'user']
                });
            }.bind(this)).then(function (attempts) {
                console.dir(attempts);
                currentUser.set('attempts', attempts);
                this.send('decrementLoadingItems');
            }.bind(this));

    }.observes('currentUser'),

    newUser: {
        name: '',
        email: '',
        password: '',
        confirmPassword: ''
    },

    signUpValidationErrors: {
        name: false,
        email: false,
        password: false,
        confirmPassword: false
    },

    resetSignUpValidationErrors: function () {
        this.set('signUpValidationErrors.name', false);
        this.set('signUpValidationErrors.email', false);
        this.set('signUpValidationErrors.password', false);
        this.set('signUpValidationErrors.confirmPassword', false);
    }.observes('newUser.name.length', 'newUser.email.length',
            'newUser.password.length', 'newUser.confirmPassword.length'),

    actions: {
        incrementLoadingItems: function () {
            this.incrementProperty('loadingItems');
        },

        decrementLoadingItems: function () {
            if (this.get('loadingItems'))
                this.decrementProperty('loadingItems');
        }
    }
});
