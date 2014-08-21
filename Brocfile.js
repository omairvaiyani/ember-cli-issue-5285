/* global require, module */

var EmberApp = require('ember-cli/lib/broccoli/ember-app');

var app = new EmberApp();

/*
 * TWITTER - BOOTSTRAP
 */
//app.import('vendor/bootstrap/dist/css/bootstrap.css.map', {
//    destDir: '/assets'
//});
//app.import('vendor/bootstrap/dist/fonts/glyphicons-halflings-regular.woff', {
//    destDir: '../fonts'
//});
//app.import('vendor/bootstrap/dist/fonts/glyphicons-halflings-regular.ttf', {
//    destDir: '../fonts'
//});
//app.import('vendor/bootstrap/dist/fonts/glyphicons-halflings-regular.svg', {
//    destDir: '../fonts'
//});
app.import({
    development: 'vendor/bootstrap/dist/js/bootstrap.js',
    production: 'vendor/bootstrap/dist/js/bootstrap.min.js'
});
app.import({
    development: 'vendor/bootstrap/dist/css/bootstrap.css',
    production: 'vendor/bootstrap/dist/css/bootstrap.min.css'
});
/*
 * FONT AWESOME
 */
//app.import('vendor/font-awesome/fonts/fontawesome-webfont.woff', {
//    destDir: '../fonts'
//});
//app.import('vendor/font-awesome/fonts/fontawesome-webfont.ttf', {
//    destDir: '../fonts'
//});
//app.import('vendor/font-awesome/fonts/fontawesome-webfont.svg', {
//    destDir: '../fonts'
//});
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

module.exports = app.toTree();
