import Ember from 'ember';

export default Ember.Route.extend({
    model: function (params, transition) {
        transition.send('incrementLoadingItems');
        var where = {
            level: 1
        };
        return this.store.findQuery('category', {where: JSON.stringify(where), order: "name"});
    },

    setupController: function (controller, model) {
        controller.set('model', model);
        this.send('decrementLoadingItems');
    }
});
