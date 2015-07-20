import Ember from 'ember';

export default Ember.Route.extend({
    actions: {
        // Struggling to get currentUser.isDirty
        // So just save all changes
        willTransition: function () {
            var controller = this.controllerFor('settings.study');
            controller.get('currentUser').save();
            return true;
        }
    }
});
