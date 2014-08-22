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
    this.resource('category', {path: 'browse/:category_slug'});
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
    this.resource('result', {path: "result/:attempt_id"});
});

export default
Router;
