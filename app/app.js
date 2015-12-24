import Ember from 'ember';
import Resolver from 'ember/resolver';
import loadInitializers from 'ember/load-initializers';
import config from './config/environment';

Ember.MODEL_FACTORY_INJECTIONS = true;

// This disables deprecation warnings
Ember.deprecate = function () {
};
Ember.warn = function (i) {
};

var App = Ember.Application.extend({
    modulePrefix: config.modulePrefix,
    Resolver: Resolver,
    /*
     * This allows us to set CSS styling directly on the App wrapper
     * Use case: pushing footer to the bottom of the page
     */
    rootElement: '#body-wrap'
});

// Check initializers/session.js for main workload and loading state.
loadInitializers(App, config.modulePrefix);

// Get Stream
App.StreamClient = stream.connect(config.getStream.publicKey, null, config.getStream.site);

export default App;
