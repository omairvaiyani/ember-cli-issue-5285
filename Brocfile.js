/* global require, module */

var EmberApp = require('ember-cli/lib/broccoli/ember-app');

var app = new EmberApp({
    minifyCSS: {
        enabled: true,
        options: {}
    },

    fingerprint: {
        exclude: ['fonts/'],
        prepend: 'http://assets.mycqs.co.uk/'
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
 * MOMENT.JS
 */
app.import({
    development: 'bower_components/moment/moment.js',
    production: 'bower_components/moment/min/moment.min.js'
});

/*
 * UNDERSCORE.JS
 */
app.import({
    development: 'bower_components/underscore/underscore.js',
    production: 'bower_components/underscore/underscore.js'
});

/*
 * PARSE JAVASCRIPT SDK
 */
app.import({
    development: 'bower_components/parse-js-sdk/lib/parse.js',
    production: 'bower_components/parse-js-sdk/lib/parse.min.js'
});
/*
 * RETINA.JS
 */
app.import({
    development: 'bower_components/retina.js/dist/retina.js',
    production: 'bower_components/retina.js/dist/retina.min.js'
});
/*
 * CSS TOGGLE SWITCH
 */
app.import('bower_components/css-toggle-switch/dist/toggle-switch.css');


module.exports = app.toTree();
