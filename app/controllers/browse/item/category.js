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
    style: "width:180px;height:150px;",

    setStyleBasedOnRelativeNumberOfTests: function () {
        var totalTests = this.get('parentController.totalTests');
        if(!totalTests)
            return;

        var totalTestsInCategory = this.get('model.totalTests'),
            relativeSize = Math.round((totalTestsInCategory / totalTests) * 100),
            width = 200,
            height = 150;

        if (relativeSize > 5) {
            width = 225;
            height = 175;
        } else if (relativeSize > 10) {
            width = 250;
            height = 185;
        } else if (relativeSize > 15) {
            width = 275;
            height = 195;
        } else if (relativeSize > 25) {
            width = 300;
            height = 200;
        }  else if (relativeSize > 35) {
            width = 350;
            height = 200;
        }

        this.set('style', "width:" + width + "px;height:" + height + "px;");
        this.incrementProperty('parentController.categoryStylesReady');
    }.observes('parentController.totalTests'),

    array: function () {
        return this.get('parentController.content');
    }.property('parentController.content.length')
});
