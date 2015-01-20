import Ember from 'ember';

export default Ember.Route.extend({
    setupController: function (controller, model) {
        controller.set('model', model);
        if(!controller.get('joinStep.create')) {
            controller.set('joinStep.join.active', true);
            controller.set('joinStep.join.disabled', false);
        }
    }
});
