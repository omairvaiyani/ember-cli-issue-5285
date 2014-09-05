import Ember from 'ember';

import EachItem from '../../../mixins/each-item';
export default Ember.ObjectController.extend({
    isFocussed: function() {
        return this.get('model') === this.get('parentController.selectedItem');
    }.property('parentController.selectedItemIndex'),

    array: function() {
        return this.get('parentController.array');
    }.property('parentController.array.length')
});
