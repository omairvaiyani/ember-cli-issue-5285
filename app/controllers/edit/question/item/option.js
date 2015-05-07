import Ember from 'ember';
import EachItem from '../../../../mixins/each-item';

export default Ember.Controller.extend(EachItem, {
    validityOption: function () {
        var idx = this.get('itemIndex'),
            parentController = this.get('parentController');
        return parentController.get('validity.options')[idx];
    }.property('model'),

    optionPhraseAltered: function () {
        this.send('optionAltered', this.get('itemIndex'));
    }.observes('model.phrase'),

    isRequired: function () {
        return this.get('itemIndex') === 1;
    }.property('itemIndex'),

    array: function () {
        return this.get('parentController.model.options');
    }.property('parentController.model.options.length')
});
