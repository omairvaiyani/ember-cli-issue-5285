import Ember from 'ember';
import EachItem from '../../../mixins/each-item';
import CurrentUser from '../../../mixins/current-user';
import EventTracker from '../../../utils/event-tracker';

export default Ember.ObjectController.extend(EachItem, CurrentUser, {
    setShuffledOptions: function () {
        var nonEmptyOptions = new Ember.A();
        this.set('totalResponsesForQuestion', 0);

        if (this.get('question.options')) {
            _.each(this.get('question.options'), function (jsonOption) {
                var option = new Ember.Object();
                option.set('isCorrect', jsonOption.isCorrect);
                option.set('phrase', jsonOption.phrase);
                option.set('numberOfTimesChosen', jsonOption.numberOfTimesChosen);
                option.set('isChosen', this.get('chosenAnswer') === option.get('phrase'));

                if (option.get('phrase')) {
                    nonEmptyOptions.pushObject(option);
                }
            }.bind(this));
        }
        if (!this.get('shuffledOptions'))
            this.set('shuffledOptions', new Ember.A());
        this.get('shuffledOptions').clear();
        this.get('shuffledOptions').addObjects(_.shuffle(nonEmptyOptions));
    }.on('init'),

    setResponseStatistics: function () {
        if (!this.get('shuffledOptions.length'))
            return;
        _.each(this.get('shuffledOptions'), function (option) {
            if (!this.get('parentController.showResponseStatistics') || !this.get('question.numberOfTimesTaken'))
                option.set('percentageOfTimesChosen', 0);
            else if (!this.get('currentUser') && this.get('itemIndex') > 0)
                option.set('percentageOfTimesChosen', 0);
            else
                option.set('percentageOfTimesChosen',
                    Math.round((option.get('numberOfTimesChosen') / this.get('question.numberOfTimesTaken')) * 100));

            option.set('statisticsStyling', "width:" + option.get('percentageOfTimesChosen') + "%;");
            option.set('statisticsTitle', "This answer was chosen by " + option.get('percentageOfTimesChosen') + "% of users.");
        }.bind(this));
    }.observes('parentController.showResponseStatistics', 'shuffledOptions.length'),

    array: function () {
        return this.get('parentController.allResponses');
    }.property('parentController.allResponses.length'),

    actions: {
        userWantsToSeeAllResponseStatistics: function () {
            EventTracker.recordEvent(EventTracker.JOIN_TO_VIEW_ALL_RESPONSE_STATISTICS, this.get('parentController.model'));
            this.transitionToRoute('join');
        }
    }
});
