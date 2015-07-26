import Ember from 'ember';
import EachItem from '../../../../mixins/each-item';

export default Ember.Controller.extend(EachItem, {
    isActive: function() {
        return _.contains(this.get('parentController.parentController.activeTags'), this.get('model'));
    }.property('parentController.parentController.activeTags.length'),

    array: function() {
        return this.get('parentController.model.tags');
    }.property('parentController.model.tags')
});
