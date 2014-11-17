import Ember from 'ember';
import EachItem from '../../../../mixins/each-item';

export default Ember.ObjectController.extend(EachItem, {
    boxStyle: function () {
        switch (this.get('itemNumber')) {
            case 1:
                return "background-color:rgb(233, 248, 250);";
            case 2:
                return "background-color:rgb(211, 241, 245);";
            case 3:
                return "background-color:rgb(169, 231, 239);";
            case 4:
                return "background-color:rgb(112, 214, 228);";
        }
    }.property(),

    uniqueResponses: function () {
        var uniqueResponses = this.get('parentController.uniqueResponses');
        if (!uniqueResponses || !uniqueResponses.length)
            return Ember.A();
        return uniqueResponses.filterProperty('spacedRepetitionBox', this.get('itemNumber'));
    }.property('parentController.uniqueResponses.length'),

    array: function () {
        return this.get('parentController.intensityConfig.boxes');
    }.property('parentController.intensityConfig.boxes.length')
});
