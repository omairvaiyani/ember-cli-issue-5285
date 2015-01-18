import Ember from 'ember';
import Resolver from 'ember/resolver';
import loadInitializers from 'ember/load-initializers';
import config from './config/environment';
import EventTracker from './utils/event-tracker';

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
EventTracker.recordEvent(EventTracker.WEBSITE_OPENED);

/*
 * zzish set up
 */
//Zzish.init("427f628d-a6d8-453a-b9a7-d54e3d8be0d3");

export default App;
