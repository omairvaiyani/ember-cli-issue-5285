import
Ember
from
'ember';

import
EachItem
from
'../../../../mixins/each-item';

export default
Ember.ObjectController.extend(EachItem, {
    validityOption: function () {
        var idx = this.get('itemIndex'),
            parentController = this.get('parentController');
        return parentController.get('validity.options')[idx];
    }.property('model'),

    optionPhraseAltered: function () {
        this.send('optionAltered', this.get('itemIndex'));
    }.observes('model.phrase'),

    array: function() {
        return this.get('parentController.options');
    }.property('parentController.options.length')
});
