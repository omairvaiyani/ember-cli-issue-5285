import
Ember
from
'ember';

import
EachItem
from
'../../../mixins/each-item';

export default
Ember.ObjectController.extend(EachItem, {
    needs: ['create', 'views/action-bar'],

    isChecked: false,

    checkChanged: function () {
        var actionBar = this.get('controllers.views/action-bar');
        if (this.get('isChecked')) {
            actionBar.addObject(this.get('controllers.create'), this.get('model'));
        } else {
            actionBar.removeObject(this.get('model'));
        }
    }.observes('isChecked'),

    array: function() {
        return this.get('parentController.questions');
    }.property('parentController.questions.length')
});
