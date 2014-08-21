import Ember from 'ember';

export default Ember.Route.extend({
    setupController: function(controller, model) {
        controller.set('content', this.controllerFor('user').get('userActions'));
    }
});
