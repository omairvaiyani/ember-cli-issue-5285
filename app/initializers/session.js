import ParseHelper from '../utils/parse-helper';

/**
 * @Initializer Session
 *
 * Halts app:
 * - Checks for sessionToken in localStorage
 * - Gets and injects currentUser
 * - initializes website with:
 * -- Config
 * -- Categories
 * -- if currentUser: tests, URs etc.
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

        if (sessionToken) {
            // Try to validate session token

            var ParseUser = store.modelFor('parse-user'),
                currentUser;

            ParseUser.validateSessionToken(store, sessionToken).then(function (response) {
                if (!(currentUser = response))
                    return new Parse.Promise().error("No Current User found.");

                application.register('user:current', currentUser, {instantiate: false, singleton: true});
                application.inject('controller:application', 'currentUser', 'user:current');

                return ParseHelper.cloudFunction(this, 'initialiseWebsiteForUser', {});
            }.bind(this)).then(function (response) {
                    // Config
                    var parseConfig = response.config;
                    container.register('config:parse', parseConfig.attributes, {instantiate: false, singleton: true});
                    container.injection('controller:application', 'parseConfig', 'config:parse');

                    // Categories
                    ParseHelper.extractRawPayload(store, 'category', response.categories);

                    ParseHelper.handleResponseForInitializeWebsiteForUser(store, currentUser, response);
                },
                function (error) {
                    // TODO if this is called due to the sessionToken being expired,
                    // We have not been able to get categories and config. Code
                    // needs refactoring.

                    console.dir(error);
                }).then(function () {
                    $("#appLoading").hide();
                    application.advanceReadiness();
                });
        } else {
            // Session not available, simply load categories and config.

            ParseHelper.cloudFunction(this, 'initialiseWebsiteForUser', {}).then(function (response) {
                // Config
                var parseConfig = response.config;
                container.register('config:parse', parseConfig.attributes, {instantiate: false, singleton: true});
                container.injection('controller:application', 'parseConfig', 'config:parse');

                // Categories
                ParseHelper.extractRawPayload(store, 'category', response.categories);
            }, function (error) {
                console.dir(error);
            }).then(function () {
                $("#appLoading").hide();
                application.advanceReadiness();
            });
        }
    }
};
