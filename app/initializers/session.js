import ParseHelper from '../utils/parse-helper';

/**
 * @Initializer Session
 *
 * APP LOADING STATE
 *
 * Halts app:
 * - Checks for sessionToken in localStorage
 * - - If found, validates session token
 * - Waits for session validation or continues to:
 * - Initialise App with Cloud Function
 * - - Gets Parse Config
 * - - Gets Categories
 * - - If session was validated earlier
 * - - - Sets user with all pointer field data
 * - - - Injects currentUser to ApplicationController
 *
 * HIDES APP LOADING STATE
 */
export default {
    name: 'session',
    after: 'parse-user-reopen',

    initialize: function (container, application) {
        var sessionToken = localStorage.sessionToken,
            store = container.lookup('store:main');

        this.store = store;

        application.deferReadiness();

        var promise = new Parse.Promise();

        if (sessionToken) {
            // Try to validate session token
            var ParseUser = store.modelFor('parse-user');

            promise = ParseUser.validateSessionToken(store, sessionToken).then(function (response) {
                if (!response)
                    return new Parse.Promise().reject("No Current User found.");

                // Whilst response is currentUser, it does not include pointer fields
                // Therefore, further below, initialiseApp CloudFunction returns a
                // a complete object.
            }.bind(this), function () {
                localStorage.removeItem("sessionToken");
                Ember.set(store.adapterFor("parse-user"), 'headers.X-Parse-Session-Token', null);
            });
        } else
            promise.resolve();

        // Either wait for sessionToken validation or promise will simply continue
        promise.then(function () {
            return ParseHelper.cloudFunction(this, 'initialiseApp', {});
        }.bind(this)).then(function (response) {
            // Config
            var parseConfig = response.config;
            container.register('config:parse', parseConfig.attributes, {instantiate: false, singleton: true});
            container.injection('controller:application', 'parseConfig', 'config:parse');

            // Categories
            ParseHelper.extractRawPayload(store, 'category', response.categories);

            // User
            if (response.user) {
                var currentUser = ParseHelper.handleUserWithIncludedData(store, response.user);

                application.register('user:current', currentUser, {instantiate: false, singleton: true});
                application.inject('controller:application', 'currentUser', 'user:current');
            }
        }, function (error) {
            console.dir(error);
        }).then(function () {
            $("#appLoading").hide();
            application.advanceReadiness();
        });
    }
};
