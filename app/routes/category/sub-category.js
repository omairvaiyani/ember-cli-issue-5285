import Ember from 'ember';

export default Ember.Route.extend({
    model: function(params) {
        this.replaceWith('category', params.subCategory_slug);
    }
});
