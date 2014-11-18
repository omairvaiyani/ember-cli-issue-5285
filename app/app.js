import Ember from 'ember';
import Resolver from 'ember/resolver';
import loadInitializers from 'ember/load-initializers';
import config from './config/environment';

Ember.MODEL_FACTORY_INJECTIONS = true;

var App = Ember.Application.extend({
    modulePrefix: config.modulePrefix,
    podModulePrefix: config.podModulePrefix,
    Resolver: Resolver,
    /*
     * This allows us to set CSS styling directly on the App wrapper
     * Use case: pushing footer to the bottom of the page
     */
    rootElement: '#body-wrap'
});

loadInitializers(App, config.modulePrefix);

export default App;
