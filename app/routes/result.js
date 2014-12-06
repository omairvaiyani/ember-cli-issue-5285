import
Ember
from
'ember';

export default
Ember.Route.extend({
    model: function (params) {
        var where = {
            "objectId": params.attempt_id
        };
        return this.store.findQuery('attempt', {where: JSON.stringify(where), include:'responses.questions'})
            .then(function(results) {
            if(!results.objectAt(0)) {
                this.transitionTo('notFound');
                return;
            } else {
                return results.objectAt(0);
            }
        }.bind(this));
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
