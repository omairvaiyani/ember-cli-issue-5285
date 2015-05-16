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
            this.send('closeModal');
            if (this.get('currentPath') !== 'search')
                this.send('deactivateSiteSearch');
        }

        var path = this.get('currentPath'),
            title = "",
            defaultTitle = "MyCQs: Create & find Multiple Choice Question (MCQ) tests online!";

        if (!path)
            return;

        switch (path) {
            case "index":
                title += defaultTitle;
                break;
            case "user.index":
                var user = this.get('controllers.user');
                title += user.get('name');
                break;
            case "user.tests":
                var user = this.get('controllers.user');
                title += user.get('name') + "'s tests";
                break;
            case "user.followers":
                var user = this.get('controllers.user');
                title += user.get('name') + "'s followers";
                break;
            case "user.following":
                var user = this.get('controllers.user');
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
    }.observes('currentPath'),

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

    manageCurrentUserSession: function () {
        var currentUser = this.get('currentUser');

        if (currentUser) {
            localStorage.sessionToken = currentUser.get('sessionToken');
            var adapter = this.store.adapterFor(currentUser);
            adapter.headers['X-Parse-Session-Token'] = currentUser.get('sessionToken');
            /*Parse.User.become(currentUser.get('sessionToken'))
             .then(function (user) {
             }, function (error) {
             console.dir(error);
             });*/
        } else {
            // TODO Logout with REST API
            /*if (Parse.User.current())
             Parse.User.logOut();*/
            localStorage.clear();
        }
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
        Ember.$.ajax({
            url: "https://api.parse.com/1/functions/initialiseWebsiteForUser",
            method: "POST",
            headers: {
                "X-Parse-Application-Id": config.parse.appId,
                "X-Parse-REST-API-Key": config.parse.restKey,
                "X-Parse-Session-Token": this.get('currentUser.sessionToken')

            }
        }).then(function (response) {
            // Categories
            ParseHelper.extractRawPayload(this.store, 'category', response.result.categories);

            // Tests
            if (response.result.createdTests) {
                var createdTests = ParseHelper.extractRawPayload(this.store, 'test', response.result.createdTests);
                this.get('currentUser.createdTests').clear();
                this.get('currentUser.createdTests').addObjects(createdTests);
            }
            if (response.result.savedTests) {
                var savedTests = ParseHelper.extractRawPayload(this.store, 'test', response.result.savedTests);
                this.get('currentUser.savedTests').clear();
                this.get('currentUser.savedTests').addObjects(savedTests);
            }
            if (response.result.uniqueResponses) {
                var uniqueResponses = ParseHelper.extractRawPayload(this.store, 'unique-response',
                    response.result.uniqueResponses);
                this.get('currentUser.uniqueResponses').clear();
                this.get('currentUser.uniqueResponses').addObjects(uniqueResponses);
            }
            /* var followers = ParseHelper.extractRawPayload(this.store, 'parse-user',
             response, 'followers');
             this.get('currentUser').set('followers', followers);

             var following = ParseHelper.extractRawPayload(this.store, 'parse-user',
             response, 'following');
             this.get('currentUser').set('following', following);

             var messages = ParseHelper.extractRawPayload(this.store, 'message',
             response, 'messages');
             this.get('currentUser').set('messages', messages);

             var groups = ParseHelper.extractRawPayload(this.store, 'group',
             response, 'groups');
             this.get('currentUser').set('groups', groups);

             var attempts = ParseHelper.extractRawPayload(this.store, 'attempt',
             response, 'attempts');
             this.get('currentUser').set('attempts', attempts);*/

            /*
             * isMobileUSer
             * Actual value on privateData to stop user's from changing it manually.
             * But easier to stick it on the currentUser in memory for simpler
             * coding. No longer need CloudFunction for this but this is a good place
             * to set this.
             */
            //this.set('currentUser.isMobileUser', this.get('currentUser.privateData.isMobileUser'));

            // This ensures index.myTestsList is filled out even when website
            // loads on a different route to index.
            this.get('controllers.index').myTestsListUpdate();
        }.bind(this));
        //EventTracker.profileUser(this.get('currentUser'));
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
        }
    }
});
