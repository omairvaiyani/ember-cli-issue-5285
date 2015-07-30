import Ember from 'ember';


/*
 * This seems to be the most robust method
 * for keeping a single instance of 'currentUser'
 * throughout the app.
 *
 * Any controller, route or other module that
 * needs 'currentUser' must import this mixin.
 *
 * Session initialization injects 'currentUser'
 * into the ApplicationController which this
 * mixin then relays to any module that imports
 * it.
 *
 * Q: Why use both property and observer?
 * A: Because the property method is unreliable
 * and caches the value, often missing value changes.
 * Observer is more reliable, however, does not run
 * on initial load: it requires a change from the first
 * value. However, once the observer kicks in, the
 * property method is removed and becomes a simple
 * pointer to the application.currentUser instance.
 *
 */

export default Ember.Mixin.create({
    needs: 'application',

    applicationController: function() {
        var applicationController = this.get('controllers.application');
        /*if(!applicationController)
            applicationController = this.controllerFor('application');*/

        return applicationController;
    }.property('controllers.application'),

    currentUser: function() {
        return this.get('applicationController.currentUser');
    }.property(),

    checkForSessionChanges: function() {
        if(this.get('applicationController.currentUser.id'))
            this.set('currentUser', this.get('applicationController.currentUser'));
    }.observes('applicationController.currentUser.id')
});
