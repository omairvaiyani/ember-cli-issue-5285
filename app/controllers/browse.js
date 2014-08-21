import Ember from 'ember';

export default Ember.Controller.extend({
    categories: function() {
        return this.store.find('category');
    }.property(),
    topLevelCategories: function() {
        return this.get('categories').filterBy('level', 1);
    }.property('categories.length')
});
