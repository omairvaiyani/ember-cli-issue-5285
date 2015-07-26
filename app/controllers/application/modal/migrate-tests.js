import Ember from 'ember';
import CurrentUser from '../../../mixins/current-user';
import ParseHelper from '../../../utils/parse-helper';

export default Ember.Controller.extend(CurrentUser, {
    init: function () {
        if(this.get('currentUser.authData.facebook')) {
            // facebook user, no need to ask for email/password
            this.send('setView', "checkingFacebookUser");
            this.send('checkCredentials');
        } else {
            this.send('setView', "credentialChecking");
        }
    },

    /**
     * @Property
     * Set initially as the current user's email,
     * but they are allowed to change it if their
     * MyCQs email was different.
     */
    oldEmail: function () {
        return this.get('currentUser.email');
    }.property(),

    oldPassword: "",

    views: ["credentialChecking", "checkingFacebookUser", "fetchingOldTests", "testSelection"],
    credentialChecking: false,
    checkingFacebookUser: false,
    fetchingOldTests: false,
    testSelection: false,

    oldTests: new Ember.A(),

    testsToMigrate: new Ember.A(),

    selectAllTests: false,

    doNotDeselectAllTests: false,

    selectAllTestsDidChange: function () {
        if (this.get('doNotDeselectAllTests'))
            return this.set('doNotDeselectAllTests', false);
        if (!this.get('selectAllTests')) {
            this.get('testsToMigrate').forEach(function (test) {
                Ember.set(test, 'isSelected', false);
            });
            this.get('testsToMigrate').clear();
        } else {
            this.get('testsToMigrate').clear();
            this.get('testsToMigrate').addObjects(this.get('oldTests'));
            this.get('testsToMigrate').forEach(function (test) {
                Ember.set(test, 'isSelected', true);
            });
        }
    }.observes('selectAllTests'),

    testsToMigrateIncludesAlreadyMigratedTests: function () {
        return !!this.get('testsToMigrate').findBy('alreadyMigrated', true);
    }.property('testsToMigrate.length'),

    actions: {
        setView: function (view) {
            _.each(this.get('views'), function (view) {
                this.set(view, false);
            }.bind(this));
            this.set(view, true);
        },

        checkCredentials: function (callback) {
            this.send('incrementLoadingItems');
            var promise = ParseHelper.cloudFunction(this, "checkIfUserExistsOnMyCQs",
                {email: this.get('oldEmail'), password: this.get('oldPassword')})
                .then(function (response) {
                    this.send('fetchOldTests', response);
                }.bind(this), function (error) {
                    console.dir(error);
                }).then(function () {
                    this.send('decrementLoadingItems');
                }.bind(this));
            if (callback)
                callback(promise);
        },

        fetchOldTests: function (oldUser) {
            this.send('incrementLoadingItems');
            this.send('setView', 'fetchingOldTests');
            ParseHelper.cloudFunction(this, "getOldTestsForUser",
                {sessionToken: oldUser.sessionToken, authorId: oldUser.objectId}).then(function (tests) {
                    this.get('oldTests').clear();
                    // Set which tests have already been migrated.
                    _.each(tests, function (test) {
                        // Match title first, then oldId.
                        var alreadyMigratedTest = this.get('currentUser.createdTests').findBy('title', test.title);
                        if (!alreadyMigratedTest)
                            alreadyMigratedTest = this.get('currentUser.createdTests').findBy('oldId', test.objectId);
                        if (alreadyMigratedTest) {
                            test.alreadyMigratedId = alreadyMigratedTest.get('id'); // This is needed for CF
                            test.alreadyMigrated = true; // This is needed for UX filters
                        }
                    }.bind(this));

                    this.get('oldTests').addObjects(tests);
                    this.send('setView', 'testSelection');
                }.bind(this), function (error) {
                    console.dir(error);
                    this.send('setView', 'credentialChecking');
                }.bind(this)).then(function () {
                    this.send('decrementLoadingItems');
                }.bind(this));
        },

        toggleTestSelect: function (test) {
            if (this.get('testsToMigrate').contains(test)) {
                this.get('testsToMigrate').removeObject(test);
                Ember.set(test, 'isSelected', false);
                if (this.get('selectAllTests')) {
                    this.set('doNotDeselectAllTests', true);
                    this.set('selectAllTests', false);
                }
            } else {
                this.get('testsToMigrate').pushObject(test);
                Ember.set(test, 'isSelected', true);
            }
        },

        beginTestMigration: function (callback) {
            var promise = ParseHelper.cloudFunction(this, "mapOldTestsToNew",
                {oldTests: this.get('testsToMigrate')}).then(function (response) {
                    // Convert tests to ember-data
                    var tests = ParseHelper.extractRawPayload(this.store, 'test', response);
                    // Add them to user's createdTests
                    this.get('currentUser.createdTests').pushObjects(tests);
                    // Notify user of completed task
                    this.send('addNotification', 'success', "Migration complete!",
                        "We have added " + tests.get('length') + " of your tests!");

                    this.send('cleanUpModalAndDismiss');
                }.bind(this), function (error) {
                    console.dir(error);
                    this.send('setView', 'credentialChecking');
                }.bind(this)).then(function () {
                    this.send('decrementLoadingItems');
                }.bind(this));
            if (callback)
                callback(promise);
        },

        cleanUpModalAndDismiss: function () {
            this.get('oldTests').clear();
            this.get('testsToMigrate').clear();
            this.set('selectAllTests', false);
            this.set('oldPassword', "");
            this.send('setView', 'credentialChecking');
            this.send('closeModal');
        }
    }
});
