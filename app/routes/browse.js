import Ember from 'ember';

export default Ember.Route.extend({
    model: function () {
        var where = {
            level: 1
        };
        return this.store.findQuery('category', {where: JSON.stringify(where), order: "name"});
    }
});
