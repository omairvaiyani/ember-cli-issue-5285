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
            }).then(function (enrichedNotifications) {

                // Better to delete here due to the delay
                // in enrichment (some activities are replaced
                // rather than deleted per se)
                if (data.deleted) {
                    _.each(data.deleted, function (id) {
                        _this.get('currentUser.notifications').removeObject(
                            _this.get('currentUser.notifications').findBy('id', id)
                        )
                    });
                }

                ParseHelper.prepareGroupedActivitiesForEmber(_this.store, enrichedNotifications);

                _this.get('currentUser.notifications').unshiftObjects(enrichedNotifications);
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
            /**
             * @jQuery Click
             *
             * Decide whether "hide.bs.dropdown"
             * should hide or not.
             * Keep open IF:
             * - Clicked a no-close classed element
             *   within a notification
             * Or
             * - Clicked anywhere in the dropdown
             *   other than a notification
             *
             * @param {jQuery.event} e
             */
            "click": function (e) {
                var target = $(e.target),
                    isThisWithinTheDropdownContainer = target.parents(".activity-notifications-dropdown").length,
                    isThisWithinTheNotificationContainer = target.parents(".activity-notification").length,
                    isThisWithinANoCloseElement = target.parents(".activity-notification-no-close").length;

                if (isThisWithinANoCloseElement)
                    this.closable = false;
                else if (isThisWithinTheNotificationContainer)
                    this.closable = true;
                else if (isThisWithinTheDropdownContainer)
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

        /**
         * @Listener
         * @Class .parent-no-scroll
         *
         * Stops scroll propagation.
         * When scrolling
         * in the notifications dropdown,
         * the inertia will not continue
         * to the main page.
         *
         */
        $('.parent-no-scroll').on('DOMMouseScroll mousewheel', function (ev) {
            var $this = $(this),
                scrollTop = this.scrollTop,
                scrollHeight = this.scrollHeight,
                height = $this.height(),
                delta = (ev.type == 'DOMMouseScroll' ?
                ev.originalEvent.detail * -40 :
                    ev.originalEvent.wheelDelta),
                up = delta > 0;

            var prevent = function () {
                ev.stopPropagation();
                ev.preventDefault();
                ev.returnValue = false;
                return false;
            };

            if (!up && -delta > scrollHeight - height - scrollTop) {
                // Scrolling down, but this will take us past the bottom.
                $this.scrollTop(scrollHeight);
                return prevent();
            } else if (up && delta > scrollTop) {
                // Scrolling up, but this will take us past the top.
                $this.scrollTop(0);
                return prevent();
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

        // called by  this.currentPathChange()
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
