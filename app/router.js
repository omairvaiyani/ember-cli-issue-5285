import
Ember
from
'ember';

var Router = Ember.Router.extend({
    location: MycqsWebENV.locationType
});

Router.map(function () {
    /*
     * Home page
     */
    this.route('application');


    /*
     * User profiles and profile editing
     */
    this.resource('user', {path: '/:user_slug'}, function() {
        this.route('tests');
        this.route('following');
        this.route('followers');
    });
    /*
     * Test browsing and searching
     */
    this.resource('browse');
    this.resource('category', {path: 'browse/:category_slug'} );
    /*this.resource('category', {path: 'browse/:category_slug'}, function() {
     this.route('subCategory', {path: '/:subCategory_slug'});
     });*/
    /*
     * Test creation and edition
     */
    this.route('create');
    this.resource('edit', {path: 'edit/:test_slug'}, function () {
        this.route('newQuestion', {path: 'new-question'});
        this.resource('editQuestion', {path: ':question_id'});
    });
    /*
     * Test taking and results
     */
    this.resource('test', {path: "mcq/:test_slug"});
    this.resource('testRedirect', {path: "mcq/:test_old_id/:test_tile"});
    this.resource('testInfo', {path: "test/:test_slug"});
    this.resource('result', {path: "result/:attempt_id"});

    /*
     * Static pages
     */
    this.route('about');
    this.route('support', {path: 'support'});
    this.route('privacyPolicy', {path: 'privacy-policy'});
    this.route('terms', {path: 'terms'});

    /*
     * Temporary sessions
     */
    this.resource('passwordReset', {path: 'password-reset/:password_reset_id'});


    /*
     * Transition to model not found or
     * Catch all undefined routes 404:
     * Both renders the four-oh-four template
     */
    this.route('notFound', {path: '/not-found'});
    this.route('fourOhFour', {path: '*path'});
});

Router.reopen({
    notifyGoogleAnalytics: function() {
        return ga('send', 'pageview', {
            'page': this.get('url'),
            'title': window.document.title
        });
    }.on('didTransition')
});

export default
Router;
