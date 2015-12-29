/*jshint node:true*/
/* global require, module */
var EmberApp = require('ember-cli/lib/broccoli/ember-app');

module.exports = function (defaults) {
    var app = new EmberApp(defaults, {
        minifyCSS: {
            enabled: true
        },

        fingerprint: {
            exclude: ['fonts/']
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
     * Raleway - FONT
     */

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
     * MOMENT with Timezones and Range
     */
    app.import({
        development: 'bower_components/moment/moment.js',
        production: 'bower_components/moment/min/moment.min.js'
    });
    app.import({
        development: 'bower_components/moment-timezone/builds/moment-timezone-with-data.js',
        production: 'bower_components/moment-timezone/builds/moment-timezone-with-data.min.js'
    });
    app.import({
        development: 'bower_components/moment-range/dist/moment-range.js',
        production: 'bower_components/moment-range/dist/moment-range.min.js'
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
        development: 'bower_components/parse/parse.js',
        production: 'bower_components/parse/parse.min.js'
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

    /*
     * jQuery KNOB
     */
    app.import({
        development: 'bower_components/jquery-knob/js/jquery.knob.js',
        production: 'bower_components/jquery-knob/dist/jquery.knob.min.js'
    });

    /*
     * Get Stream
     */
    app.import({
        development: 'bower_components/getstream/dist/js/getstream.js',
        production: 'bower_components/getstream/dist/js_min/getstream.js'
    });


    return app.toTree();
};