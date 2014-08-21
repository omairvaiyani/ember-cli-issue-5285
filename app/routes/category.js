import Ember from 'ember';

export default Ember.Route.extend({
    model: function(params) {
        return this.store.findById('category', params.category_id);
    }
});
