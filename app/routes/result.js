import
Ember
from
'ember';

export default
Ember.Route.extend({
    model: function (params) {
        return this.store.findById('attempt', params.attempt_id);
    },

    setupController: function (controller, model) {
        controller.set('model', model);
        if (this.controllerFor('test').get('savingResponses')) {
            model.get('responses')
                .then(function (responses) {
                    if (!responses.length)
                        responses.addObjects(this.controllerFor('test').get('responses'));
                }.bind(this));
        }
    }
});
