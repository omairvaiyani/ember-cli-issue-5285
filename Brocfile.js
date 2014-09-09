/* global require, module */

var EmberApp = require('ember-cli/lib/broccoli/ember-app');

var app = new EmberApp();

/*
 * TWITTER - BOOTSTRAP
 */
app.import({
    development: 'vendor/bootstrap/dist/js/bootstrap.js',
    production: 'vendor/bootstrap/dist/js/bootstrap.min.js'
});
app.import({
    development: 'vendor/bootstrap/dist/css/bootstrap.css.map',
    production: 'vendor/bootstrap/dist/css/bootstrap.css.map'
});
app.import({
    development: 'vendor/bootstrap/dist/css/bootstrap.css',
    production: 'vendor/bootstrap/dist/css/bootstrap.min.css'
});
/*
 * FONT AWESOME
 */
app.import({
    development: 'vendor/font-awesome/css/font-awesome.css',
    production: 'vendor/font-awesome/css/font-awesome.min.css'
});
/*
 * MOMENT.JS
 */
app.import({
    development: 'vendor/moment/min/moment-with-locales.js',
    production: 'vendor/moment/min/moment-with-locales.min.js'
});

/*
 * UNDERSCORE.JS
 */
app.import({
    development: 'vendor/underscore/underscore.js',
    production: 'vendor/underscore/underscore.js'
});

/*
 * PARSE JAVASCRIPT SDK
 */
app.import({
    development: 'vendor/parse-js-sdk/lib/parse.js',
    production: 'vendor/parse-js-sdk/lib/parse.min.js'
});
/*
 * RETINA.JS
 */
app.import({
    development: 'vendor/retina.js/dist/retina.js',
    production: 'vendor/retina.js/retina.min.js'
});
/*
 * CSS TOGGLE SWITCH
 */
app.import('vendor/css-toggle-switch/dist/toggle-switch.css');

module.exports = app.toTree();
