import Ember from 'ember';
import EachItem from '../../../mixins/each-item';

export default Ember.ObjectController.extend(EachItem, {
    array: function() {
        return this.get('parentController.allResponses');
    }.property('parentController.allResponses.length')
});
