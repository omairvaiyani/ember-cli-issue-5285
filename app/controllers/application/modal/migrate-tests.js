import Ember from 'ember';
import CurrentUser from '../../../mixins/current-user';
import ParseHelper from '../../../utils/parse-helper';

export default Ember.Controller.extend(CurrentUser, {
    init: function () {
        if(this.get('currentUser.firstTimeLogin')) {
            this.send('setView', 'explanation');
            this.set('currentUser.firstTimeLogin', false);
            this.get('currentUser').save();
        } else if (this.get('currentUser.authData.facebook')) {
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

    incorrectDetails: false,

    views: ["explanation", "credentialChecking", "checkingFacebookUser",
        "fetchingOldTests", "testSelection", "migratingTests"],
    explanation: false,
    credentialChecking: false,
    checkingFacebookUser: false,
    fetchingOldTests: false,
    testSelection: false,
    migratingTests: false,

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

    migrateSelectedTestsLabel: function () {
        var buttonLabel = "Migrate " + this.get('testsToMigrate.length') + " test";
        if(this.get('testsToMigrate.length') > 1)
            buttonLabel += "s";
        return buttonLabel;
    }.property("testsToMigrate.length"),

    migrationProgress: 0,

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
                }.bind(this), function () {
                    this.set('incorrectDetails', true);
                    setTimeout(function () {
                        this.set('incorrectDetails', false);
                    }.bind(this), 2000);
                }.bind(this)).then(function () {
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

        migrateAllTests: function () {
            this.set('selectAllTests', true);
            this.send('beginTestMigration');
        },

        beginTestMigration: function (callback) {
            this.send('setView', 'migratingTests');
            var batches = [new Ember.A()],
                currentBatchIndex = 0,
                batchPromise = new Parse.Promise();

            this.get('testsToMigrate').forEach(function (test) {
                if (batches[currentBatchIndex].get('length') > 10) {
                    batches.push(new Ember.A());
                    currentBatchIndex++;
                }
                batches[currentBatchIndex].pushObject(test);
            });
            var parseResponses = [];
            var batchLoop = function (batchIndex) {
                this.incrementProperty('migrationProgress', 5);
                ParseHelper.cloudFunction(this, "mapOldTestsToNew",
                    {oldTests: batches[batchIndex]}).then(function (response) {
                        this.set('migrationProgress', Math.round( ((batchIndex + 1) / batches.length ) * 100));
                        parseResponses.push.apply(parseResponses, response);
                        if(batchIndex + 1 < batches.length) {
                            setTimeout(function () {
                                batchLoop(batchIndex + 1);
                            }, 9000);
                        } else {
                            batchPromise.resolve(parseResponses);
                        }
                    }.bind(this));
            }.bind(this);
            batchLoop(0);
            var promise = Parse.Promise.when(batchPromise).then(function (response) {
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

        explanationRead: function () {
            if (this.get('currentUser.authData.facebook')) {
                // facebook user, no need to ask for email/password
                this.send('setView', "checkingFacebookUser");
                this.send('checkCredentials');
            } else {
                this.send('setView', "credentialChecking");
            }
        },

        cleanUpModalAndDismiss: function () {
            this.get('oldTests').clear();
            this.get('testsToMigrate').clear();
            this.set('selectAllTests', false);
            this.set('oldPassword', "");
            this.set('migrationProgress', 0);
            this.send('setView', 'credentialChecking');
            this.send('closeModal');
        }
    }
});
