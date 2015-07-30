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
            var ParseUser = store.modelFor('parse-user'),
                currentUser;

            ParseUser.validateSessionToken(store, sessionToken).then(function (user) {
                if (!user)
                    return;
                currentUser = user;
                application.register('user:current', currentUser, {instantiate: false, singleton: true});
                application.inject('controller:application', 'currentUser', 'user:current');

                return ParseHelper.cloudFunction(this, 'initialiseWebsiteForUser', {});
            }.bind(this)).then(function (response) {
                    // Config
                    var parseConfig = response.config;
                    container.register('config:parse', parseConfig, {instantiate: false, singleton: true});
                    container.injection('controller:application', 'parseConfig', 'config:parse');

                    // Categories
                    ParseHelper.extractRawPayload(store, 'category', response.categories);

                    // Tests
                    if (response.createdTests) {
                        var createdTests = ParseHelper.extractRawPayload(store, 'test', response.createdTests);
                        currentUser.get('createdTests').clear();
                        currentUser.get('createdTests').addObjects(createdTests);
                    }
                    if (response.savedTests) {
                        var savedTests = ParseHelper.extractRawPayload(store, 'test', response.savedTests);
                        currentUser.get('savedTests').clear();
                        currentUser.get('savedTests').addObjects(savedTests);
                    }
                    if (response.uniqueResponses) {
                        var uniqueResponses = ParseHelper.extractRawPayload(store, 'unique-response',
                            response.uniqueResponses);
                        currentUser.get('uniqueResponses').clear();
                        currentUser.get('uniqueResponses').addObjects(uniqueResponses);
                    }
                    if (response.educationCohort) {
                        var educationCohort = ParseHelper.extractRawPayload(store, 'education-cohort',
                            response.educationCohort);
                        currentUser.set('educationCohort', educationCohort);
                    }
                    if (response.srLatestTest) {
                        var srLatestTest = ParseHelper.extractRawPayload(store, 'test',
                            response.srLatestTest);
                        currentUser.set('srLatestTest', srLatestTest);
                    }
                },
                function (error) {
                    console.dir(error);
                }).then(function () {
                    $("#appLoading").hide();
                    application.advanceReadiness();
                });
        } else {
            ParseHelper.cloudFunction(this, 'initialiseWebsiteForUser', {}).then(function (response) {
                // Config
                var parseConfig = response.config;
                container.register('config:parse', parseConfig, {instantiate: false, singleton: true});
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
