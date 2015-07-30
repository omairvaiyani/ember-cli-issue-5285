/* global require, module */

var EmberApp = require('ember-cli/lib/broccoli/ember-app');

var app = new EmberApp({
    minifyCSS: {
        enabled: true,
        options: {}
    },

    fingerprint: {
        exclude: ['fonts/'],
        //prepend: 'https://assets.synap.com/' // SSL not set!
        prepend: 'https://s3-eu-west-1.amazonaws.com/synap-dev-assets/' // SSL certified.
    },

    stylusOptions: {
        "include css": true
    }
});

/*
 * TWITTER - BOOTSTRAP
 */
app.import({
    development: 'bower_components/bootstrap/dist/js/bootstrap.js',
    production: 'bower_components/bootstrap/dist/js/bootstrap.min.js'
});
app.import({
    development: 'bower_components/bootstrap/dist/css/bootstrap.css.map',
    production: 'bower_components/bootstrap/dist/css/bootstrap.css.map'
});
app.import({
    development: 'bower_components/bootstrap/dist/css/bootstrap.css',
    production: 'bower_components/bootstrap/dist/css/bootstrap.min.css'
});
/*
 * MATERIAL DESIGN FOR BOOTSTRAP
 */

/*
 Changing the primary material colour requires LESS.
 We use Stylus. Therefore, we are compiling the material.css
 separately using a git clone.

 app.import({
 development: 'bower_components/bootstrap-material-design/dist/css/material-fullpalette.css',
 production: 'bower_components/bootstrap-material-design/dist/css/material-fullpalette.min.css'
 });*/
app.import({
    development: 'bower_components/bootstrap-material-design/dist/js/material.js',
    production: 'bower_components/bootstrap-material-design/dist/js/material.min.js'
});
app.import('bower_components/bootstrap-material-design/dist/js/material.min.js.map');
/*
 * FONT AWESOME
 */
app.import({
    development: 'bower_components/font-awesome/css/font-awesome.css',
    production: 'bower_components/font-awesome/css/font-awesome.min.css'
});
/*
 * MOMENT with Timezones
 */
app.import({
    development: 'bower_components/moment/moment.js',
    production: 'bower_components/moment/min/moment.min.js'
});
app.import({
    development: 'bower_components/moment-timezone/builds/moment-timezone-with-data.js',
    production: 'bower_components/moment-timezone/builds/moment-timezone-with-data.min.js'
});

/*
 * UNDERSCORE.JS
 */
app.import({
    development: 'bower_components/underscore/underscore.js',
    production: 'bower_components/underscore/underscore-min.js'
});

/*
 * PARSE JAVASCRIPT SDK
 */
app.import({
    development: 'bower_components/parse-js-sdk/lib/parse.js',
    production: 'bower_components/parse-js-sdk/lib/parse.min.js'
});

/*
 * NUMERAL.JS
 */
app.import({
    development: 'bower_components/numeral/numeral.js',
    production: 'bower_components/numeral/min/numeral.min.js'
});
/*
 * CSS TOGGLE SWITCH
 */
app.import('bower_components/css-toggle-switch/dist/toggle-switch.css');
/*
 * JS TIMEZONE DETECT
 */
app.import('bower_components/jstz/jstz.js');
/*
 * ALGOLIA SEARCH
 */
app.import({
    development: 'bower_components/algoliasearch/dist/algoliasearch.js',
    production: 'bower_components/algoliasearch/dist/algoliasearch.min.js'
});

module.exports = app.toTree();
