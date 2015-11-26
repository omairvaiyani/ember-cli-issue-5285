import Ember from 'ember';
import ParseHelper from '../utils/parse-helper';
import CurrentUser from '../mixins/current-user';
import EventTracker from '../utils/event-tracker';

export default Ember.Controller.extend(CurrentUser, {
    didPass: function () {
        return this.get('model.score') > 39;
    }.property('model.score'),

    /*
     * bind-attr css requires
     * boolean values
     */
    currentTab: 'all',
    isTabAll: true,
    isTabCorrect: false,
    isTabIncorrect: false,

    allResponses: function () {
        console.dir(this.get('model.responses'));
        var allResponses = [];
        this.get('model.questions').forEach(function (question) {
            var questionHasResponse = false;
            this.get('model.responses').forEach(function (response) {
                var responseQuestionId = response.get('_data.question');
                if (!responseQuestionId)
                    responseQuestionId = response.get('_data.question');
                if (responseQuestionId === question.get('id')) {
                    allResponses.pushObject(response);
                    questionHasResponse = true;
                }
            }.bind(this));
            if (!questionHasResponse) {
                var responseForSkippedQuestion = this.store.createRecord('response', {
                    question: question,
                    isCorrect: false,
                    chosenOptions: [],
                    correctionOptions: [question.get('options').findBy('isCorrect', true).phrase]
                });
                allResponses.pushObject(responseForSkippedQuestion);
            }
        }.bind(this));

        return allResponses;
    }.property('model.responses.length'),

    correctResponses: function () {
        return this.get('model.responses').filterBy('isCorrect', true);
    }.property('model.responses.length'),

    incorrectResponses: function () {
        if (this.get('allResponses.length'))
            return this.get('allResponses').filterBy('isCorrect', false);
        else
            return this.get('model.responses').filterBy('isCorrect', false);
    }.property('allResponses.length'),

    categoryTests: [],
    getCategoryTests: function () {
        if (!this.get('model.test.category.id') || this.get('categoryTests.length'))
            return;

        var categoryTests = [],
            where = {
                'category': ParseHelper.generatePointer(this.get('model.test.category.content'))
            };
        this.store.findQuery('test', {where: JSON.stringify(where), order: '-createdAt', limit: '5'})
            .then(function (tests) {
                this.get('categoryTests').clear();
                this.get('categoryTests').addObjects(tests);
            }.bind(this));
        return categoryTests;
    }.observes('model.test.category.id'),

    showResponseStatisticsDidChange: function () {
        if (this.get('showResponseStatistics'))
            EventTracker.recordEvent(EventTracker.VIEWED_RESPONSE_STATISTICS, this.get('model'));
    }.observes('showResponseStatistics'),

    showScoreArc: false,

    style: {
        colorSecondary: "#e41d72",
        colorBorder: "#eaeaea",
        colorOrange: "#FF8833"

    },

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
        },

        addQuestionsToSRS: function (addAll) {
            var questionIds = [];
            this.get('model.responses').forEach(function (response) {
                if (addAll ||
                    response.get('correctAnswer') !== response.get('chosenAnswer'))
                    questionIds.push(response.get('question.id'));
            });
            this.send('incrementLoadingItems');
            this.set('addingOrRemovingQuestionsToSRS', true);
            // TODO switch to ParseHelper
            Parse.Cloud.run('addOrRemoveQuestionsToSRSTest', {questionIds: questionIds, task: 0})
                .then(function () {
                    this.set('addingOrRemovingQuestionsToSRS', false);
                    this.set('areQuestionsAddedToSRS', true);
                    this.send('decrementLoadingItems');
                    this.send('addNotification', 'saved', 'Questions added to SRS!');
                }.bind(this), function (error) {
                    console.dir(error);
                    this.set('addingOrRemovingQuestionsToSRS', false);
                    this.send('decrementLoadingItems');
                    this.send('addNotification', 'error', 'There was an error!', 'We could not add questions' +
                        ' to your spaced repetition at this time.');
                }.bind(this));
        },
        removeQuestionsFromSRS: function () {
            var questionIds = [];
            this.get('responses').forEach(function (response) {
                questionIds.push(response.get('question.id'));
            });
            this.send('incrementLoadingItems');
            this.set('addingOrRemovingQuestionsToSRS', true);
            // TODO switch to ParseHelper
            Parse.Cloud.run('addOrRemoveQuestionsToSRSTest', {questionIds: questionIds, task: 1})
                .then(function () {
                    this.set('addingOrRemovingQuestionsToSRS', false);
                    this.set('areQuestionsAddedToSRS', false);
                    this.send('decrementLoadingItems');
                    this.send('addNotification', 'deleted', 'Questions removed from SRS!');
                }.bind(this), function (error) {
                    console.dir(error);
                    this.set('addingOrRemovingQuestionsToSRS', false);
                    this.send('decrementLoadingItems');
                    this.send('addNotification', 'error', 'There was an error!', 'We could not remove questions' +
                        ' to your spaced repetition at this time.');
                }.bind(this));
        }
    }

});
