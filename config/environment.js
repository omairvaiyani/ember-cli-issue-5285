/* jshint node: true */

module.exports = function (environment) {
    var ENV = {
        modulePrefix: 'synap-web',
        environment: environment,
        baseURL: '/',
        locationType: 'auto',
        EmberENV: {
            FEATURES: {
                // Here you can enable experimental features on an ember canary build
                // e.g. 'with-controller': true
            }
        },

        APP: {
            // Here you can pass flags/options to your application instance
            // when it is created

            // Currently synap-dev
            // Also hard-coded in index.html, change that too!
            applicationId: "yUHivsy47OB5vVimMTV3s0Hc91a0vrM2JPM3aWst",
            restApiId: "YWipkMx0KTb3U6DYdPHXtfGy2QRVQA6xfSY3QKTr",
            jsKey: "J4oAZA2qRHiCA324x0kQyEXiXuRXZPMA01wLN1xK"
        },

        googleMap: {
            key: 'AIzaSyANfra0HUx4jAl73-RKvOzJl36vWwq0T5U'
        },

        getStream: {
            publicKey: "fcx4w2mtbg2w",
            site: "8320"
        }
    };

    if (environment === 'development') {
        // ENV.APP.LOG_RESOLVER = true;
        //ENV.APP.LOG_ACTIVE_GENERATION = true;
        // ENV.APP.LOG_TRANSITIONS = true;
        // ENV.APP.LOG_TRANSITIONS_INTERNAL = true;
        //ENV.APP.LOG_VIEW_LOOKUPS = true;
    }

    if (environment === 'test') {
        // Testem prefers this...
        ENV.baseURL = '/';
        ENV.locationType = 'auto';

        // keep test console output quieter
        //ENV.APP.LOG_ACTIVE_GENERATION = false;
        //ENV.APP.LOG_VIEW_LOOKUPS = false;

        ENV.APP.rootElement = '#ember-testing';
    }

    if (environment === 'production') {

    }

    return ENV;
};
