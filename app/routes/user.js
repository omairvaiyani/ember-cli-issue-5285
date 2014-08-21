import
Ember
from
'ember';

export default
Ember.Route.extend({
    model: function (params) {
        return this.store.findById('parse-user', params.user_id);
    },
    setupController: function (controller, model) {
        controller.set('model', model);
    }
});
