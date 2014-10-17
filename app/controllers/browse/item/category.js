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
    style: "width:220px;height:200px;",

    setStyleBasedOnRelativeNumberOfTests: function () {
        var totalTests = this.get('parentController.totalTests');
        if(!totalTests)
            return;

        var totalTestsInCategory = this.get('model.totalTests'),
            relativeSize = Math.round((totalTestsInCategory / totalTests) * 100),
            width = 200,
            height = 200;

        this.set('style', "width:" + width + "px;height:" + height + "px;");
        this.incrementProperty('parentController.categoryStylesReady');
    }.observes('parentController.totalTests'),

    array: function () {
        return this.get('parentController.content');
    }.property('parentController.content.length')
});
