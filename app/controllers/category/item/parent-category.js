import Ember from 'ember';
import EachItem from '../../../mixins/each-item';

export default Ember.Controller.extend(EachItem, {
    isActive: function () {
        return this.get('model.id') === this.get('parentController.model.id') ||
            this.get('model.id') === this.get('parentController.model.parent.id');
    }.property('parentController.model'),

    isSemiActive: function () {
        return this.get('model.id') === this.get('parentController.model.parent.id');
    }.property('parentController.model'),

    array: function () {
        return this.get('parentController.topLevelCategories');
    }.property('parentController.topLevelCategories.length')
});
