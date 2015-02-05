import Ember from 'ember';
import config from './config/environment';

var Router = Ember.Router.extend({
    location: config.locationType
});

Router.map(function () {
    /*
     * Home page
     */
    this.route('application');

    /*
     * Site Search
     */
    this.resource('search');

    /*
     * Join (onboarding)
     */
    this.resource('join', {path: "join"}, function () {
        this.route('personalise');
        this.route('features');
    });
    /*
     * User profiles and profile editing
     */
    this.resource('user', {path: '/:user_slug'}, function () {
        this.route('tests');
        this.route('following');
        this.route('followers');
    });
    /*
     * Test browsing and searching
     */
    this.resource('browse');
    this.resource('browseRedirect', {path: 'tests/:category_slug'});
    this.resource('category', {path: 'browse/:category_slug'});
    this.resource('subcategory', {path: 'browse/:category_slug/:subcategory_slug'});
    /*
     * Test creation and edition
     */
    this.resource('create', {path: "create"}, function () {
        this.route('join');
        this.route('personalise');
        this.route('features');
        this.route('addQuestions');
    });
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
    this.resource('result.new', {path: 'result/new'});
    /*
     * Groups
     */
    this.resource('groups');
    this.route('createGroup', {path: 'group/create'});
    this.resource('group', {path: 'group/:group_slug'}, function () {
        this.resource('editGroup', {path: 'edit'});
    });
    /*
     * Static pages
     */
    this.route('about', function () {
        this.route('team');
    });
    this.route('support', {path: 'support'});
    this.route('privacyPolicy', {path: 'privacy-policy'});
    this.route('terms', {path: 'terms'});
    this.resource('features', {path: 'features'}, function () {
        this.route('srs');
    });
    this.route('presskit', {path: 'press'});
    this.route('contact');

    /*
     * Temporary sessions
     */
    this.resource('passwordReset', {path: 'password-reset/:password_reset_id'});

    /*
     * Premium dashboard. e.g. SRS
     */
    this.resource('dashboard');


    /*
     * Transition to model not found or
     * Catch all undefined routes 404:
     * Both renders the four-oh-four template
     */
    this.route('notFound', {path: '/not-found'});
    this.route('fourOhFour', {path: '*path'});
});

Router.reopen({
    notifyGoogleAnalytics: function () {
        return ga('send', 'pageview', {
            'page': this.get('url'),
            'title': window.document.title
        });
    }.on('didTransition')
});

export default
    Router;
