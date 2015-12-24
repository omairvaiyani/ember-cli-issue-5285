import Ember from 'ember';
import ParseHelper from '../utils/parse-helper';
import EventTracker from '../utils/event-tracker';
import CryptoHash from '../utils/crypto-hash';

export default Ember.Controller.extend({
    needs: ['index', 'index/user', 'test', 'category'],

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
            case "index.index":
                title += defaultTitle;
                if (!this.get('currentUser')) {
                    this.set('navbarTransparent', true);
                    this.set('hideNavbarSearch', true);
                    this.get('controllers.index').resizeIndexCover();
                    this.get('controllers.index').shouldShowStats();
                }
                break;
            case "index.user":
                // Dynamic route, handle within route
                break;
            case "create.index":
                title += "Create - Make MCQ Tests and Quizzes";
                EventTracker.recordEvent(EventTracker.VIEWED_CREATE_PAGE);
                break;
            case "edit":
                title += "Quiz Editor";
                break;
            case "browse":
                title += "Browse - Find Quizzes";
                EventTracker.recordEvent(EventTracker.VIEWED_BROWSE_HOME);
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
            case "index.progress":
                EventTracker.recordEvent(EventTracker.VIEWED_PROGRESS);
                break;
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
        // Code here may not run after certain switch cases.
        // Only update page title
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
        var _this = this,
            currentUser = _this.get('currentUser'),
            adapter = _this.store.adapterFor("parse-user");

        if (currentUser) {
            _this.send('bootIntercomCommunications', currentUser);

            // Session Token Handling
            // May no longer have it due to object manipulation after 'intialiseApp' below
            localStorage.sessionToken = currentUser.get('sessionToken');
            Ember.set(adapter, 'headers.X-Parse-Session-Token', currentUser.get('sessionToken'));

            // Check if User has been Initialised
            var promises = [],
                initialiseUserPromise = new Parse.Promise();

            // Set Up Current User Tiles
            _this.get('controllers.index').setUserTilesRefresherCycle();

            if (_.contains(_this.get('parseConfig').adminIds, _this.get('currentUser.id')))
                _this.set('currentUser.isAdmin', true);

            // If the user was previously logged in, sessionToken is validated
            // in the SessionInitializer along with the initialiseApp Cloud function
            // - else, we need the cloud function part here
            if (!currentUser.get('initialisedFor')) {
                initialiseUserPromise = ParseHelper.cloudFunction(_this, 'initialiseApp', {})
                    .then(function (response) {
                        // Returned user object has all pointer fields included
                        ParseHelper.handleUserWithIncludedData(_this.store, response.user);
                        if (response.notifications)
                            ParseHelper.assignNotificationsToCurrentUser(_this.store, currentUser, response.notifications);

                    }, function (error) {
                        console.dir(error);
                    });
            } else {
                initialiseUserPromise.resolve();
            }

            promises.push(ParseHelper.cloudFunction(_this, 'loadMyTestsList', {}));
            promises.push(ParseHelper.cloudFunction(_this, 'loadFollowersAndFollowing', {}));

            promises.push(initialiseUserPromise);
            Promise.all(promises).then(function (promiseResults) {
                ParseHelper.handleRelationalDataResponseForUser(_this.store, currentUser, promiseResults[0]);
                ParseHelper.handleRelationalDataResponseForUser(_this.store, currentUser, promiseResults[1]);
                _this.get('controllers.index/user').myTestsListUpdate();

                _this.listenForActivityNotifications();

                EventTracker.profileUser(_this.get('currentUser'));
            }, function (error) {
                console.dir(error);
            }).then(function () {
                _this.send('decrementLoadingItems');
            });

        } else {
            // User not logged in
            localStorage.removeItem("sessionToken");
            Ember.set(adapter, 'headers.X-Parse-Session-Token', null);
        }
    }.observes('currentUser'),

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
        return !!this.get('signUpValidationErrors.name.length') || !!this.get('signUpValidationErrors.email.length')
            || !!this.get('signUpValidationErrors.password.length');
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

    /**
     * @Function Listen for Activity Notifications
     */
    listenForActivityNotifications: function () {
        var _this = this;

        _this.monitorActivityNotificationsDropDown(); // As good a place as any to call this once only function.

        var notificationFeed = Ember.StreamClient.feed('notification', _this.get('currentUser.id'),
            _this.get('currentUser.notificationFeedToken'));

        _this.set('currentUser.notificationFeed', notificationFeed);

        notificationFeed.subscribe(function callback(data) {
            ParseHelper.cloudFunction(_this, 'enrichActivityStream', {
                activities: data.new
            }).then(function (notifications) {
                ParseHelper.prepareGroupedActivitiesForEmber(_this.store, notifications);
                _this.get('currentUser.notifications').unshiftObjects(notifications);
                _this.set('currentUser.totalUnseenNotifications', data.unseen);
                _this.set('currentUser.totalReadNotifications', data.unread);
            });
        });
    },

    /**
     * @jQuery Monitor Activity Notifications Dropdown
     *
     * a) Send action on display (to mark all as 'seen')
     *
     * b) Stop bootstrap code from closing the container
     * if user clicks within the dropdown
     *
     * This code is working well and does not leak the
     * jQuery binder.
     *
     * Called once from this.listenForActivityNotifications
     */
    monitorActivityNotificationsDropDown: function () {
        var _this = this;
        $('.dropdown.activity-notifications').on({
            "shown.bs.dropdown": function () {
                this.closable = true;
                _this.send('activityNotificationsShown');
            },
            "click": function (e) {
                var target = $(e.target);
                if (target.parents(".activity-notifications-dropdown").length)
                    this.closable = false;
                else
                    this.closable = true;
            },
            "hide.bs.dropdown": function (e) {
                var closable = this.closable;
                this.closable = true;
                return closable;
            }
        });
    },

    /**
     * @Observer Update Notification Counter on Web Tab
     */
    updateNotificationsCounterOnWebTab: function () {
        if (this.get('currentUser.totalUnseenNotifications'))
            window.document.title = "(" + this.get('currentUser.totalUnseenNotifications') + ") " + window.document.title;
        else if (window.document.title.charAt(0) === "(")
            window.document.title = window.document.title.substr(window.document.title.indexOf(" ") + 1);
    }.observes('currentUser.totalUnseenNotifications'),

    betaActivated: function () {
        return !!localStorage.betaActivationId;
    }.property(),


    actions: {
        incrementLoadingItems: function () {
            this.incrementProperty('loadingItems');
        },

        decrementLoadingItems: function () {
            if (this.get('loadingItems'))
                this.decrementProperty('loadingItems');
        },

        /**
         * @Action Activity Notifications Shown
         * The Activity Notification dropdown has been
         * opened.
         * If there are any unseen notifications:
         * - We will notify our stream to mark
         *   all notifications as 'seen'.
         * - Update the total unseen and unread
         *   counter with the server response
         */
        activityNotificationsShown: function () {
            var _this = this;
            if (_this.get('currentUser.totalUnseenNotifications') && _this.get('currentUser.notificationFeed')) {
                _this.get('currentUser.notificationFeed').get({mark_seen: true}).then(function (response) {
                    _this.set('currentUser.totalUnseenNotifications', response.unseen);
                    _this.set('currentUser.totalReadNotifications', response.unread);
                });
            }
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
        },

        bootIntercomCommunications: function (currentUser) {
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
                created_at: Date.parse(currentUser.get('createdAt')) / 1000
            });
        },

        /**
         * @Action Take User from Login Modal to Request Beta Invite
         * Temporary function, simply closes modal, goes to home
         * page, scrolls and focuses to request beta invite.
         */
        takeUserFromLoginModalToRequestBetaInvite: function () {
            this.send('closeModal');
            this.transitionTo('index');
            setTimeout(function () {
                this.get('controllers.index').send('indexBackToTopScroll');
            }.bind(this), 500);
        }
    }
});
