import Ember from 'ember';

// Check for deprecation, using SubcategoryRoute
export default Ember.Route.extend({
    model: function (params) {
        this.replaceWith('category', params.subCategory_slug);
    }
});
