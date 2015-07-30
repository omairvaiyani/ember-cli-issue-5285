import Ember from 'ember';
import Resolver from 'ember/resolver';
import loadInitializers from 'ember/load-initializers';
import config from './config/environment';
import EventTracker from './utils/event-tracker';

Ember.MODEL_FACTORY_INJECTIONS = true;

// This disables deprecation warnings
Ember.deprecate = function(){};
Ember.warn = function(i){};

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

/*
 * zzish set up
 *//*
Zzish.init("lOBKJskSfI1S6DPzEOB5FzNMk3ca");

*//*
 * addThis
 *//*
window.addthis_reload = function () {
    if (!window.addthis) {
        // Load addThis, if it hasn't already been loaded.
        window['addthis_config'] = { 'data_track_addressbar' : false };
        $('body').append('<script type="text/javascript" ' +
        'src="https://s7.addthis.com/js/300/addthis_widget.js#pubid=ra-54d949656c333bb3"></script>');
    } else {
        // Already loaded? Then re-attach it to the newly rendered set of social icons.
        // And reset share url/title, so they don't carry-over from the previous page.
        window['addthis_share'].url = window.location.href;
        window['addthis_share'].title = window.document.title;
        window.addthis.toolbox('.addthis_toolbox');
    }
};*/

export default App;
