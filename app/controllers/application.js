import Ember from 'ember';
import ParseHelper from '../utils/parse-helper';
import EventTracker from '../utils/event-tracker';
import CryptoHash from '../utils/crypto-hash';

export default Ember.Controller.extend({
    needs: ['index', 'user', 'test', 'category'],

    /*
     * Observes for route transitions and currentUser.totalUnreadMessages.length
     * - Use path to determine title
     * - Send preliminary title to ApplicationRoute.updateTitle()
     */
    currentPathDidChange: function () {
        // Blurring here to allow the user to navigate
        // between search results and the modal view,
        // without blur. But, when they eventually
        // click on a test/user, the route change
        // will ensure this input focus is not leaked.
        this.send('navbarSearchHardBlur');

        if (window.prerenderReady) {
            if (this.get('currentPath') !== 'search')
                this.send('deactivateSiteSearch');
        }

        window.Intercom('update');

        var path = this.get('currentPath'),
            title = "",
            defaultTitle = "Synap - Study smart.";

        if (!path)
            return;

        this.send('closeModal');
        var user;
        this.set('navbarTransparent', false);
        this.set('hideNavbarSearch', false);
        switch (path) {
            case "index":
                title += defaultTitle;
                if (!this.get('currentUser')) {
                    this.set('navbarTransparent', true);
                    this.set('hideNavbarSearch', true);
                    this.get('controllers.index').resizeIndexCoverVideo();
                    this.get('controllers.index').shouldShowStats();
                }
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
            // Intercom.io
            /*window.intercomSettings = {

                "app_id": "pjy1btre"
            };*/
            window.Intercom('boot', {
                app_id: "oibyis4o",
                user_hash: currentUser.get('intercomHash'),
                user_id: currentUser.get('id'),
                name: currentUser.get('name'),
                email: currentUser.get('email'),
                timeZone: currentUser.get('timeZone'),
                profileImageURL: currentUser.get('profileImageURL'),
                points: currentUser.get('points'),
                srActivated: currentUser.get('srActivated'),
                signUpSource: currentUser.get('signUpSource'),
                numberOfTestsCreated: currentUser.get('numberOfTestsCreated'),
                receivePromotionalEmails: currentUser.get('receivePromotionalEmails'),
                created_at: Date.parse(currentUser.get('createdAt'))/1000
            });

            // Session Token Handling
            localStorage.sessionToken = currentUser.get('sessionToken');
            var adapter = this.store.adapterFor("parse-user");
            Ember.set(adapter, 'headers.X-Parse-Session-Token', currentUser.get('sessionToken'));
            if (!this.get('websiteNotInitialisedForUser'))
                return this.get('controllers.index').myTestsListUpdate();
            else
                this.send('incrementLoadingItems');

            // Load user's content if not already done so in initialisers
            ParseHelper.cloudFunction(this, 'initialiseWebsiteForUser', {}).then(function (response) {
                ParseHelper.handleResponseForInitializeWebsiteForUser(this.store, currentUser, response);
                this.get('controllers.index').myTestsListUpdate();
                //EventTracker.profileUser(this.get('currentUser'));
            }.bind(this), function (error) {
                console.dir(error);
            }).then(function () {
                this.send('decrementLoadingItems');
            }.bind(this));

        } else {
            // Log user out
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
        password: ''
    },

    signUpValidationErrors: {
        name: "",
        email: "",
        password: "",
        signUp: ""
    },

    /**
     * @Property Sign Up Validation has Errors
     * Needed by ApplicationRoute.actions.signUp
     * @return {Boolean}
     */
    signUpValidationHasErrors: function () {
        return this.get('signUpValidationErrors.name.length') || this.get('signUpValidationErrors.email.length')
        || this.get('signUpValidationErrors.password.length');
    }.property('signUpValidationErrors.name.length', 'signUpValidationErrors.email.length',
        'signUpValidationErrors.password.length'),

    resetSignUpValidationErrors: function () {
        this.set('signUpValidationErrors.name', "");
        this.set('signUpValidationErrors.email', "");
        this.set('signUpValidationErrors.password', "");
        this.set('signUpValidationErrors.signUp', "");
    }.observes('newUser.name.length', 'newUser.email.length',
        'newUser.password.length'),

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

    /*
     * Search in Navbar
     */
    searchClient: function () {
        return algoliasearch("ONGKY2T0Y8", "8553807a02b101962e7bfa8c811fd105");
    }.property(),

    navbarSearchTerm: "",
    navbarSearchResults: {tests: new Ember.A(), users: new Ember.A()},

    performNavbarSearch: function () {
        var queries = [],
            testQuery = {
                indexName: "Test",
                query: this.get('navbarSearchTerm'),
                params: {
                    hitsPerPage: 5
                }
            },
            userQuery = {
                indexName: "User",
                query: this.get('navbarSearchTerm'),
                params: {
                    hitsPerPage: 5
                }
            };
        queries.push(testQuery);
        queries.push(userQuery);
        this.get('searchClient').search(queries).then(function (response) {
            var testResponse = response.results[0],
                userResponse = response.results[1],
                tests = ParseHelper.extractRawPayload(this.store, 'test', testResponse.hits),
                users = ParseHelper.extractRawPayload(this.store, 'parse-user', userResponse.hits);

            // Algolia cache's results which should be great BUT
            // Ember-Data removes the .id from payloads when extracting
            // This causes an error on 'response.hits' cache as their
            // 'id' has been removed.
            this.get('searchClient').clearCache();

            this.set('navbarSearchTotalTestResults', testResponse.nbHits);
            this.set('navbarSearchTotalUserResults', userResponse.nbHits);

            this.get('navbarSearchResults.tests').clear();
            this.get('navbarSearchResults.tests').addObjects(tests);

            this.get('navbarSearchResults.users').clear();
            this.get('navbarSearchResults.users').addObjects(users);

            this.set('navbarSearchFetching', false);
        }.bind(this));
    },

    throttleNavbarSearch: function () {
        this.set('navbarSearchFetching', this.get('navbarSearchTerm.length') > 0);

        if (!this.get('navbarSearchTerm.length')) {
            this.get('navbarSearchResults.tests').clear();
            this.get('navbarSearchResults.users').clear();
            this.set('navbarSearchTotalTestResults', 0);
            this.set('navbarSearchTotalUserResults', 0);
            return;
        }
        Ember.run.debounce(this, this.performNavbarSearch, 200);
    }.observes('navbarSearchTerm.length'),

    navbarSearchTotalTestResults: 0,
    navbarSearchTotalUserResults: 0,
    navbarSearchTotalResults: function () {
        return this.get('navbarSearchTotalTestResults') + this.get('navbarSearchTotalUserResults');
    }.property('navbarSearchTotalTestResults', 'navbarSearchTotalUserResults'),
    navbarSearchMoreTestsToShow: function () {
        return this.get('navbarSearchTotalTestResults') > this.get('navbarSearchResults.tests.length');
    }.property('navbarSearchTotalTestResults', 'navbarSearchResults.tests.length'),

    navbarSearchDual: function () {
        return this.get('navbarSearchResults.tests.length') && this.get('navbarSearchResults.users.length');
    }.property('navbarSearchResults.tests.length', 'navbarSearchResults.users.length'),

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

        // Called from the search icon
        focusOnNavbarSearch: function () {
            $('#navbar-search-input').focus();
        },

        // input focus-in action
        navbarSearchFocused: function () {
            this.set('navbarSearchIsFocused', true);
        },

        // By click outside the input or results (includes the X span)
        navbarSearchBlurred: function () {
            // Set up a jQuery function to hide the input
            // if clicked outside the form-control or
            // the popdown results div, or the X span.
            if (!this.get('jqueryNavbarSearchHiderSet')) {
                $(document).mouseup(function (e) {
                    var container = $("#navbar-search-container"),
                        modal = $("#myModal");
                    if (!container.is(e.target) && !modal.is(e.target)
                        && (_.contains(e.target.classList, "close-icon") ||
                            (container.has(e.target).length === 0 &&
                            modal.has(e.target).length === 0)
                        )) {
                        this.send('navbarSearchHardBlur');
                    }
                }.bind(this));
                this.set('jqueryNavbarSearchHiderSet', true);
            }
        },

        // called by actions.navbarSearchBlurred
        // or currentPathChange
        navbarSearchHardBlur: function () {
            this.set('navbarSearchIsFocused', false);
            this.set('navbarSearchTerm', "");
            $('#navbar-search-input').blur();
        },

        navbarSearchTakeToBrowseForResults: function () {
            this.transitionTo('category', "all",
                {
                    queryParams: {searchTerm: this.get('navbarSearchTerm')}
                });
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
                if (callback)
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
