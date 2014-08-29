import
Ember
from
'ember';

import
ParseHelper
from
'../utils/parse-helper';

export default
Ember.ObjectController.extend({
    loading: 'Preparing test...',

    setTimeStarted: function () {
        if (!this.get('preparingTest')) {
            this.set('timeStarted', new Date());
        }
    }.observes('preparingTest'),

    modal: {
        title: "",
        message: ""
    },

    currentQuestionIndex: 0,

    currentQuestionNumber: function () {
        return this.get('currentQuestionIndex') + 1;
    }.property('currentQuestionIndex'),

    currentQuestion: function () {
        if (!this.get('shuffledQuestions')) {
            return;
        }

        return this.get('shuffledQuestions').objectAt(this.get('currentQuestionIndex'));
    }.property('currentQuestionIndex', 'shuffledQuestions'),

    isOptionSelected: function (optionIndex) {
        return this.get('currentQuestion.shuffledOptions.' + optionIndex + '.isSelected');
    },

    clearOptionSelection: function () {
        for (var i = 0; i < this.get('currentQuestion.shuffledOptions.length'); i++) {
            this.set('currentQuestion.shuffledOptions.' + i + '.isSelected', false);
        }
        this.set('currentQuestion.isAnswered', false);
    },

    questionsAnswered: function () {
        if (!this.get('shuffledQuestions')) {
            return;
        }

        var questionsAnswered = [];
        this.get('shuffledQuestions').forEach(function (question) {
            if (question.get('isAnswered'))
                questionsAnswered.push(question);
        });

        return questionsAnswered;
    }.property('shuffledQuestions.@each.isAnswered'),

    actions: {
        optionSelected: function (optionIndex) {
            /*
             * If already answered:
             * - Clear option selection
             * - Set currentQuestion.isAnswered to false
             * - End function
             */
            if (this.isOptionSelected(optionIndex)) {
                this.clearOptionSelection();
                return;
            }
            /*
             * Else:
             * - Clear all option selections
             * - Set this option.isSelected to true
             * - Set currentQuestion.isAnswered to true
             * - Increment currentQuestionIndex (go to next question), Or,
             * - Finish test
             */
            this.clearOptionSelection();

            this.set('currentQuestion.shuffledOptions.' + optionIndex + '.isSelected', true);
            this.set('currentQuestion.isAnswered', true);

            if (this.get('currentQuestionIndex') < (this.get('shuffledQuestions.length') - 1))
                this.incrementProperty('currentQuestionIndex');
            else
                this.send('confirmFinish');
        },
        previousQuestion: function () {
            if (this.get('currentQuestionIndex'))
                this.decrementProperty('currentQuestionIndex');
        },
        nextQuestion: function () {
            if (this.get('currentQuestionIndex') < (this.get('shuffledQuestions.length') - 1))
                this.incrementProperty('currentQuestionIndex');
            else
                this.send('confirmFinish');

        },
        confirmFinish: function () {
            if (!this.get('questionsAnswered.length')) {
                this.set('modal.title', "Error?!");
                this.set('modal.message', "We can't mark your test if you don't answer any questions!");
            } else if (this.get('questionsAnswered.length') < this.get('shuffledQuestions.length')) {
                this.set('modal.title', "Are you sure you've finished?");
                this.set('modal.message', "You have only answered " + this.get('questionsAnswered.length') + " questions!");
            } else {
                this.set('modal.title', "Finish");
                this.set('modal.message', "You have answered all " + this.get('shuffledQuestions.length') + " questions!");
            }

            this.send('openModal', 'test/modals/finish-test', 'test');
        },
        /**
         * ---------
         * Mark Test
         * ---------
         * Currently the responses objects are all saved individually
         * It takes too long and the results page requires the objects
         */
        isMarking: false,
        markTest: function () {
            this.send('closeModal');
            this.set('loading', 'Marking test...');
            var attempt = this.store.createRecord('attempt', {
                test: this.get('model'),
                user: this.get('currentUser'),
                timeStarted: this.get('timeStarted'),
                timeCompleted: new Date()
            });

            /*
             * Create an array of 'responses':
             * - Loop through questionsAnswered
             * - Loop through shuffledOptions in each question
             * - Set correctAnswer and chosenAnswer in response
             * - Create a response record and save to server
             * - Add response to 'responses' array
             */
            var score = 0,
                responsesArray = [];

            this.get('questionsAnswered').forEach(function (question) {
                var chosenAnswer, correctAnswer, isCorrect = false;
                question.get('shuffledOptions').forEach(function (option) {
                    if (option.isSelected)
                        chosenAnswer = option.phrase;
                    if (option.isCorrect)
                        correctAnswer = option.phrase;
                });

                if (chosenAnswer === correctAnswer) {
                    isCorrect = true;
                    score++;
                }

                var response = this.store.createRecord('response', {
                    chosenAnswer: chosenAnswer,
                    correctAnswer: correctAnswer,
                    question: question,
                    isCorrect: isCorrect,
                    test: this.get('model'),
                    user: this.get('currentUser')
                });

                responsesArray.pushObject(response);
            }.bind(this));

            score = Math.floor((score / this.get('shuffledQuestions.length')) * 100);
            attempt.set('score', score);

            var arrayOfPromises = [],
                savedResponses;

            responsesArray.forEach(function (response) {
                arrayOfPromises.push(response.save());
            });

            Em.RSVP.Promise.all(arrayOfPromises).then(function (result) {
                savedResponses = result;
                return attempt.get('responses');
            }).then(function (responses) {
                responses.addObjects(savedResponses);
                return attempt.get('questions');
            }).then(function (questions) {
                    questions.addObjects(this.get('shuffledQuestions'));
                    return attempt.save();
                }.bind(this)).then(function (attempt) {
                    this.store.createRecord('action', {
                        user: this.get('currentUser'),
                        type: 'attemptFinished',
                        test: this.get('model'),
                        attempt: attempt,
                        value: score
                    });
                    this.get('currentUser').incrementProperty('numberOfAttempts');
                    this.transitionToRoute('result', attempt);
                }.bind(this));

        }
    }

});
