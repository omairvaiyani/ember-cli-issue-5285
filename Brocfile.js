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

module.exports = app.toTree();
