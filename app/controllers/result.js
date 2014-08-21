import
Ember
from
'ember';

export default
Ember.ObjectController.extend({
    didPass: function () {
        if (this.get('score') < 40)
            return false;
        else
            return true;
    }.property('score'),

    /*
     * bind-attr css requires
     * boolean values
     */
    currentTab: 'all',
    isTabAll: true,
    isTabCorrect: false,
    isTabIncorrect: false,

    allResponses: function () {
        if (!this.get('questionsLoaded')) {
            console.log("Questions not loaded!");
            this.get('questions').then(function (questions) {
                this.set('questionsLoaded', true);
            }.bind(this));
            return;
        }
        var allResponses = [];
        this.get('questions').forEach(function (question) {
            var questionHasResponse = false;
            this.get('responses').forEach(function (response) {
                if (response.get('_data.question.id') === question.get('id')) {
                    allResponses.pushObject(response);
                    questionHasResponse = true;
                }
            }.bind(this));
            if (!questionHasResponse) {
                var responseForSkippedQuestion = this.store.createRecord('response', {
                   question: question,
                   isCorrect: false,
                   chosenAnswer: "",
                   correctAnswer: question.get('options').findBy('isCorrect', true).phrase
                });
                allResponses.pushObject(responseForSkippedQuestion);
            }
        }.bind(this));

        return allResponses;
    }.property('responses.length', 'questionsLoaded'),

    correctResponses: function () {
        return this.get('responses').filterBy('isCorrect', true);
    }.property('responses.length'),

    incorrectResponses: function () {
        if(this.get('allResponses.length'))
            return this.get('allResponses').filterBy('isCorrect', false);
        else
            return this.get('responses').filterBy('isCorrect', false);
    }.property('allResponses.length'),

    actions: {
        switchTab: function (tab) {
            this.set('tab', tab);
            this.set('isTabAll', false);
            this.set('isTabCorrect', false);
            this.set('isTabIncorrect', false);
            switch (tab) {
                case 'all':
                    this.set('isTabAll', true);
                    break;
                case 'correct':
                    this.set('isTabCorrect', true);
                    break;
                case 'incorrect':
                    this.set('isTabIncorrect', true);
                    break;
            }
        }
    }

});
