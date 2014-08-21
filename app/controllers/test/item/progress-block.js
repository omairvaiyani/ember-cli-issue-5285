import Ember from 'ember';
import EachItem from '../../../mixins/each-item';

export default Ember.ObjectController.extend(EachItem, {
    isCurrentItem: function() {
        if(!this.get('array') || !this.get('array.length'))
            return;

        if(this.get('parentController.currentQuestionIndex') === this.get('itemIndex'))
            return true;
        else
            return false
    }.property('parentController.currentQuestionIndex', 'content.length'),

    progressBlockWidth: function () {
        var style = "width:calc(100%/" + this.get('parentController.shuffledQuestions.length') + ");";
        return style;
    }.property('array.length'),

    array: function() {
       return this.get('parentController.shuffledQuestions');
    }.property('parentController.shuffledQuestions.length')
});
