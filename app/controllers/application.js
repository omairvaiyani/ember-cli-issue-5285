import Ember from 'ember';
import ParseHelper from '../utils/parse-helper';
import EmberParseAdapter from '../adapters/parse';
import ExpandingSearch from '../utils/expanding-search';
import EventTracker from '../utils/event-tracker';
import config from './../config/environment';

export default Ember.Controller.extend({
    needs: ['index', 'user', 'test', 'category'],

    /*
     * Observes for route transitions and currentUser.totalUnreadMessages.length
     * - Use path to determine title
     * - Send preliminary title to ApplicationRoute.updateTitle()
     */
    currentPathDidChange: function () {
        if (window.prerenderReady) {
            if (this.get('currentPath') !== 'search')
                this.send('deactivateSiteSearch');
        }

        var path = this.get('currentPath'),
            title = "",
            defaultTitle = "Synap - Study smart.";

        if (!path)
            return;
        this.send('closeModal');
        var user;
        this.set('navbarTransparent', false);
        switch (path) {
            case "index":
                title += defaultTitle;
                if (!this.get('currentUser'))
                    this.set('navbarTransparent', true);
                break;
            case "user.index":
                user = this.get('controllers.user');
                title += user.get('name');
                break;
            case "user.tests":
                user = this.get('controllers.user');
                title += user.get('name') + "'s tests";
                break;
            case "user.followers":
                user = this.get('controllers.user');
                title += user.get('name') + "'s followers";
                break;
            case "user.following":
                user = this.get('controllers.user');
                title += user.get('name') + "'s following";
                break;
            case "create.index":
                title += "Create - Make MCQ Tests and Quizzes";
                break;
            case "edit":
                title += "Test editor";
                break;
            case "browse":
                title += "Browse - Find tests and quizzes";
                break;
            case "category":
                var category = this.get('controllers.category');
                if (category.get('secondaryName'))
                    title += category.get('secondaryName') + " MCQs";
                else
                    title += category.get('name') + " MCQs";
                break;
            case "test":
            case "testInfo":
                /*
                 * Handled in TestRoute.
                 */
                window.scrollTo(0, 0);
                return;
            case "result":
                title += "Results";
                break;
            case "privacyPolicy":
                title += "Privacy Policy";
                break;
            case "terms":
                title += "Terms and Conditions";
                break;
            case "presskit":
                title += "Press Information";
                break;
            case "groups":
                title += "Groups - MCQ Tests for Classes";
                break;
            case "group":
            case "group.index":
                /*
                 * Handled in GroupRoute.
                 */
                window.scrollTo(0, 0);
                return;
            case "join.index":
                title += "Join - Create an Account";
                break;
            case "medical":
                title += "Medical Test Generator";
                break;
            case "about.team":
                title += "Team";
                break;
            default:
                title += defaultTitle;
                break;
        }
        if (!title || !title.length)
            title = defaultTitle;

        this.send('updatePageTitle', title);
        window.scrollTo(0, 0);
    }.observes('currentPath', 'currentUser'),

    /*
     * Search in Navbar
     */
    searchInputText: "",

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
        this.set('loginMessage.connecting', '');
    }.observes('loginUser.email.length', 'loginUser.password.length'),

    /**
     * @Observes Manage Current Session
     * If no currentUser, localStorage.sessionToken is removed
     * and we set 'websiteNotInitialisedForUser' as true.
     *
     * If currentUser is found, sessionToken is set to
     * localStorage and on the RestAdapter. Also,
     * currentUser may be set in the initializer:session
     * stage, therefore, the initialiseWebsiteForUser CC
     * is not called. However, if user signs in after
     * website load, then it is called.
     */
    manageCurrentUserSession: function () {
        var currentUser = this.get('currentUser');

        if (currentUser) {
            localStorage.sessionToken = currentUser.get('sessionToken');
            var adapter = this.store.adapterFor(currentUser);
            adapter.headers['X-Parse-Session-Token'] = currentUser.get('sessionToken');

            if(!this.get('websiteNotInitialisedForUser'))
                return this.get('controllers.index').myTestsListUpdate();
            ParseHelper.cloudFunction(this, 'initialiseWebsiteForUser', {}).then(function (response) {
                ParseHelper.handleResponseForInitializeWebsiteForUser(this.store, currentUser, response);
                this.get('controllers.index').myTestsListUpdate();
                //EventTracker.profileUser(this.get('currentUser'));
            }.bind(this));

        } else {
            // TODO Logout with REST API
            localStorage.clear();
            this.set('websiteNotInitialisedForUser', true);
        }
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

    changePassword: {
        oldPassword: "",
        newPassword: "",
        confirmPassword: ""
    },

    actions: {
        incrementLoadingItems: function () {
            this.incrementProperty('loadingItems');
        },

        decrementLoadingItems: function () {
            if (this.get('loadingItems'))
                this.decrementProperty('loadingItems');
        },

        markMessageAsRead: function (message) {
            if (!message.get('read')) {
                message.set('read', true);
                if (this.get('currentUser.totalUnreadMessages'))
                    this.decrementProperty('currentUser.totalUnreadMessages');
                message.save();
            }
        },

        markMessageAsUnread: function (message) {
            if (message.get('read')) {
                message.set('read', false);
                this.incrementProperty('currentUser.totalUnreadMessages');
                message.save();
            }
        },

        updateNotificationsCounter: function () {
            if (this.get('currentUser.totalUnreadMessages'))
                window.document.title = "(" + this.get('currentUser.totalUnreadMessages') + ") " + window.document.title;
            else if (window.document.title.charAt(0) === "(")
                window.document.title = window.document.title.substr(window.document.title.indexOf(" ") + 1);
        },

        searchItemClicked: function (object, className) {
            if (className === 'test')
                this.transitionToRoute('testInfo', object.slug);
            else if (className === 'parse-user')
                this.transitionToRoute('user', object.slug);
        },

        changePassword: function (callback) {
            if (this.get('changePassword.newPassword') !== this.get('changePassword.confirmPassword')) {
                this.send('addNotification', 'error', 'Error!', "Your new passwords do not match.");
                if(callback)
                    callback(new Parse.Promise.error());
                return;
            }

            var promise = ParseHelper.cloudFunction(this, 'changePassword', {
                oldPassword: this.get('changePassword.oldPassword'),
                newPassword: this.get('changePassword.newPassword')
            }).then(function () {
                this.send('addNotification', 'saved', 'Success!', "Your password has been changed.");
                this.send('closeModal');
            }.bind(this), function (response) {
                console.dir(response);
                this.send('addNotification', 'error', 'Error!', response.error);
            }.bind(this));

            if (callback)
                callback(promise);
        }
    }
});
