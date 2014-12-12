import Ember from 'ember';
import EachItem from '../../../mixins/each-item';
export default Ember.ObjectController.extend(EachItem, {
    correctOptionIndex: function () {
        for(var i = 0; i < this.get('shuffledOptions.length'); i++) {
            if(this.get('shuffledOptions')[i].isCorrect)
                return i;
        }
    }.property('shuffledOptions.length'),
    array: function () {
        return this.get('parentController.shuffledQuestions');
    }.property('parentController.shuffledQuestions.length')
});
