import
    Ember
    from
        'ember';

import
    ParseHelper
    from
        '../utils/parse-helper';

import EmberParseAdapter from '../adapters/parse';

import
    ExpandingSearch
    from
        '../utils/expanding-search';

export default
    Ember.Controller.extend({
        needs: ['index', 'user', 'test', 'category'],

        /*
         * Observes for route transitions and currentUser.totalUnreadMessages.length
         * - Use path to determine title
         * - Send preliminary title to ApplicationRoute.updateTitle()
         */
        currentPathDidChange: function () {
            var path = this.get('currentPath'),
                title = "",
                defaultTitle = "MyCQs - A social learning network";

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
                case "create":
                    title += "Create - Test Maker";
                    break;
                case "edit":
                    title += "Test editor";
                    break;
                case "browse":
                    title += "Browse - Find tests and quizzes";
                    break;
                case "category":
                    var category = this.get('controllers.category');
                    title += category.get('name');
                    break;
                case "test":
                case "testInfo":
                    /*
                     * Handled in TestRoute.
                     */
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
        searchData: {
            groups: Ember.A(),
            totalRecords: 0
        },

        getSearchData: function () {
            this.get('searchData.groups').clear();
            if (this.get('searchInput.length') < 3)
                return;

            var params = {
                q: this.get('searchInput').toLowerCase(),
                engine_key: "KpTvAqftjz7ZaGG7FPr7"
            };


            $.getJSON("https://api.swiftype.com/api/v1/public/engines/suggest.json", params)
                .done(
                function (data) {
                    var tests = {
                            title: "Tests",
                            records: data.records.tests,
                            totalRecords: data.info.tests.total_result_count,
                            key: "title",
                            imageKey: "authorImageUrl",
                            className: "test"
                        },
                        users = {
                            title: "Users",
                            records: data.records.users,
                            totalRecords: data.info.users.total_result_count,
                            key: "name",
                            imageKey: "profileImageUrl",
                            className: "parse-user"
                        };
                    this.get('searchData.groups').clear();
                    this.get('searchData.groups').pushObject(tests);
                    this.get('searchData.groups').pushObject(users);
                    this.set('searchData.totalRecords', data.info.tests.total_result_count + data.info.users.total_result_count);
                }.bind(this)
            );
        }.observes('searchInput.length'),

        isExpandingSearchReady: false,

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
                var adapter = this.store.adapterFor(currentUser);
                adapter.headers['X-Parse-Session-Token'] = currentUser.get('sessionToken');
                Parse.User.become(currentUser.get('sessionToken'))
                    .then(function (user) {
                    }, function (error) {
                        console.dir(error);
                    });
                localStorage.sessionToken = currentUser.get('sessionToken');
                setTimeout(function () {
                    /*
                     * This updates the user with privateData
                     * and facebook friends list every time
                     * the user logs in. The time out allows
                     * the adapter to fully prepare the data
                     * before saving abruptly.
                     */
                    this.get('currentUser').save();
                }.bind(this), 2000)
            }
            else {
                if (Parse.User.current())
                    Parse.User.logOut();
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
            this.send('incrementLoadingItems');
            var currentUser = this.get('currentUser');

            EmberParseAdapter.ParseUser.getFollowing(this.store, currentUser).then(function () {
                return EmberParseAdapter.ParseUser.getFollowers(this.store, currentUser);
            }.bind(this))
                .then(function () {
                    return EmberParseAdapter.ParseUser.getMessages(this.store, currentUser);
                }.bind(this))
                .then(function () {
                    this.send('decrementLoadingItems');
                }.bind(this));


            /*this.incrementProperty('loadingItems');
             if (!currentUser.get('latestAttempts')) {
             this.incrementProperty('decrementLoadingItems');
             return;
             }*/
            var where = {
                "user": ParseHelper.generatePointer(currentUser),
                "isSRSAttempt": {
                    "$ne": true
                }
            };
            this.store.findQuery('attempt', {
                where: JSON.stringify(where),
                order: '-createdAt',
                include: 'test.category,user',
                limit: 15
            }).then(function (attempts) {
                currentUser.set('attempts', attempts);
                this.send('decrementLoadingItems');
                /*
                 * Is mobile user?
                 */
                return Parse.Cloud.run('isMobileUser', {userId: currentUser.get('id')});
            }.bind(this))
                .then(function (response) {
                    currentUser.set('isMobileUser', response);
                    currentUser.get('latestAttempts');
                });

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
