import
    Ember
    from
        'ember';

import
    ParseHelper
    from
        '../utils/parse-helper';

import CurrentUser from '../mixins/current-user';

export default
    Ember.ObjectController.extend(CurrentUser, {
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
            if (this.get('allResponses.length'))
                return this.get('allResponses').filterBy('isCorrect', false);
            else
                return this.get('responses').filterBy('isCorrect', false);
        }.property('allResponses.length'),

        categoryTests: [],
        getCategoryTests: function () {
            if (!this.get('test.category.id') || this.get('categoryTests.length'))
                return;

            var categoryTests = [],
                where = {
                    'category': ParseHelper.generatePointer(this.get('test.category.content'))
                };
            this.store.findQuery('test', {where: JSON.stringify(where), order: '-createdAt', limit: '5'})
                .then(function (tests) {
                    this.get('categoryTests').clear();
                    this.get('categoryTests').addObjects(tests);
                }.bind(this));
            return categoryTests;
        }.observes('test.category.id'),

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
                this.get('responses').forEach(function (response) {
                    if (addAll ||
                        response.get('correctAnswer') !== response.get('chosenAnswer'))
                        questionIds.push(response.get('question.id'));
                });
                this.send('incrementLoadingItems');
                this.set('addingOrRemovingQuestionsToSRS', true);
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
