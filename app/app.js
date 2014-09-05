import
Ember
from
'ember';

import
Resolver
from
'ember/resolver';

import
loadInitializers
from
'ember/load-initializers';

Ember.MODEL_FACTORY_INJECTIONS = true;

var App = Ember.Application.extend({
    modulePrefix: 'mycqs-web', // TODO: loaded via config
    Resolver: Resolver,
    /*
     * This allows us to set CSS styling directly on the App wrapper
     * Use case: pushing footer to the bottom of the page
     */
    rootElement: '#body-wrap'
});

loadInitializers(App, 'mycqs-web');

/*
 * Parse keys also used in ApplicationAdapter
 */
Parse.initialize("DjQgBjzLml5feb1a34s25g7op7Zqgwqk8eWbOotT", "3gLHMYHWB2QFrv4MOSgi4xA6MnAowdMw9UMw3NJM");

export default
App;
