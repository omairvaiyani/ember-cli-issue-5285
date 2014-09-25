import
Ember
from
'ember';

export default
Ember.Route.extend({
    model: function (params, transition) {
        transition.send('incrementLoadingItems');
        var where = {
            "slug": params.test_slug
        };
        return this.store.findQuery('test', {where: JSON.stringify(where)})
            .then(function (results) {
                if (results.objectAt(0)) {
                    return results.objectAt(0);
                } else {
                    return;
                }
            }.bind(this));
    },
    setupController: function (controller, model) {
        if (!model) {
            this.transitionTo('notFound');
            return;
        }
        controller.set('model', model);
    }
});
