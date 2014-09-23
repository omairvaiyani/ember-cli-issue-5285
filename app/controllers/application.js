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
    needs: ['index', 'user', 'test', 'category'],

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
            case "index":
                title = "DEFAULT";
                break;
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
        if (!title)
            title = "DEFAULT";
        this.send('updateTitle', title);

        if (path === "index")
            this.get('controllers.index').send('toggleParallaxScrollListener', true);
        else
            this.get('controllers.index').send('toggleParallaxScrollListener', false);
    }.observes('currentPath'),

    loadingItems: 0,

    currentUser: null,

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
            Parse.User.become(currentUser.get('sessionToken')).then(function (user) {
            }, function (error) {
                console.dir(error);
            });
            localStorage.sessionToken = currentUser.get('sessionToken');
        }
        else {
            if (Parse.User.current())
                Parse.User.logOut();
            localStorage.clear();
        }
        //this.get('controllers.index').send('toggleParallaxScrollListener');
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
                currentUser.set('attempts', attempts);
                this.send('decrementLoadingItems');
            }.bind(this));

    }.observes('currentUser'),

    currentUserMessagesDidChange: function () {
        if (!this.get('currentUser'))
            return;
        if (!this.get('currentUser.messages')) {
            this.set('currentUser.totalUnreadMessages', 0);
            this.send('updateNotificationsCounter');
            return;
        }
        var totalUnreadMessages = 0;
        if (this.get('currentUser.messages.length')) {
            this.get('currentUser.messages').forEach(function (message) {
                if (!message.get('read')) {
                    totalUnreadMessages++;
                }
            });
        }
        this.set('currentUser.totalUnreadMessages', totalUnreadMessages);
        this.send('updateNotificationsCounter');
    }.observes('currentUser.messages.length'),

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

    /**
     * @property {Array} The array of app-wide notifications
     */
    notifications: Em.A(),

    /**
     * @observer Not technically necessary, but cleans up
     * the notifications array when all have been closed
     */
    notificationsWereClosed: function () {
        var notifications = this.get('notifications');
        // Don't do anything if there are no notifications.
        if (!notifications.length) {
            return;
        }
        // If all the notifications have been closed,
        // wipe our list clean so cruft doesn't build up
        if (this.get('notifications').everyBy('closed')) {
            this.set('notifications', Em.A());
        }
    }.observes('notifications.@each.closed'),

    actions: {
        incrementLoadingItems: function () {
            this.incrementProperty('loadingItems');
        },

        decrementLoadingItems: function () {
            if (this.get('loadingItems'))
                this.decrementProperty('loadingItems');
        },

        markMessageAsRead: function (message) {
            if(!message.get('read')) {
                message.set('read', true);
                if(this.get('currentUser.totalUnreadMessages'))
                    this.decrementProperty('currentUser.totalUnreadMessages');

                message.save();
            }
        },

        markMessageAsUnread: function (message) {
            if(message.get('read')) {
                message.set('read', false);
                if(this.get('currentUser.totalUnreadMessages'))
                    this.incrementProperty('currentUser.totalUnreadMessages');
                message.save();
            }
        },
        updateNotificationsCounter: function () {
            if (this.get('currentUser.totalUnreadMessages'))
                window.document.title = "(" + this.get('currentUser.totalUnreadMessages') + ") " + window.document.title;
            else if(window.document.title.charAt(0) === "(")
                window.document.title = window.document.title.substr(window.document.title.indexOf(" ") + 1);
        }
    }
});
