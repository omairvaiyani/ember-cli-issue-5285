import Ember from 'ember';
import CurrentUser from '../mixins/current-user';
import ParseHelper from '../utils/parse-helper';
import EventTracker from '../utils/event-tracker';

export default Ember.ObjectController.extend(CurrentUser, {
    loading: 'Preparing test...',

    setTimeStarted: function () {
        if (!this.get('preparingTest')) {
            this.set('timeStarted', new Date());
            this.send('prerenderReady');
            setTimeout(function () {
                EventTracker.recordEvent(EventTracker.STARTED_TEST, this.get('model'));
            }.bind(this), 1000);
        }
    }.observes('preparingTest'),

    modal: {
        title: "",
        message: "",
        suggestions: "",
        error: false
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

    inPrintView: false,

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
            this.set('modal.error', false);
            if (!this.get('questionsAnswered.length')) {
                this.set('modal.title', "Error!");
                this.set('modal.message', "We cannot mark your test if you do not answer any questions!");
                this.set('modal.suggestions', "Please press 'Go back' to return to the test");
                this.set('modal.error', true);
            } else if (this.get('questionsAnswered.length') < this.get('shuffledQuestions.length')) {
                this.set('modal.title', "Are you sure you have finished?");
                this.set('modal.message', "You have only answered " + this.get('questionsAnswered.length') +
                " of " + this.get('questions.length') + " questions!");
                this.set('modal.suggestions', "You can skip those questions by pressing 'Mark test' or " +
                "press 'Go back' to return to the test.");
            } else {
                this.set('modal.title', "Finish");
                this.set('modal.message', "You have answered all " + this.get('shuffledQuestions.length') + " questions!");
                this.set('modal.suggestions', "Get your results by pressing 'Mark test', or check your answers by pressing" +
                " 'Go back'.");
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
            this.send('incrementLoadingItems');
            this.send('closeModal');
            this.set('loading', 'Marking test...');
            var attempt;
            if (!this.get('isSRSTest')) {
                attempt = this.store.createRecord('attempt', {
                    test: this.get('model')
                });
                if (this.get('currentUser'))
                    attempt.set('user', this.get('currentUser'));
            } else
                attempt = this.get('model');

            attempt.set('timeStarted', this.get('timeStarted'));
            attempt.set('timeCompleted', new Date());

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
                    test: attempt.get('test.content')
                });
                if (this.get('currentUser'))
                    response.set('user', this.get('currentUser'));
                responsesArray.pushObject(response);
            }.bind(this));

            score = (score / this.get('shuffledQuestions.length')) * 100;
            attempt.set('score', score);

            attempt.get('questions')
                .then(function (questions) {
                    questions.addObjects(this.get('shuffledQuestions'));
                    return attempt.get('responses');
                }.bind(this))
                .then(function (responses) {
                    responses.addObjects(responsesArray);
                })
                .then(function () {
                    this.set('unsavedAttempt', attempt);
                    this.transitionToRoute('result.new');
                    this.send('decrementLoadingItems');
                }.bind(this));

            var arrayOfPromises = [],
                savedResponses;
            responsesArray.forEach(function (response) {
                arrayOfPromises.push(response.save());
            });
            Em.RSVP.Promise.all(arrayOfPromises).then(function (result) {
                //savedResponses = result;
                return attempt.save();
            }.bind(this))
                .then(function () {
                    EventTracker.recordEvent(EventTracker.COMPLETED_TEST, attempt);
                    if (this.get('currentUser')) {
                        if (this.get('currentUser.attempts'))
                            this.get('currentUser.attempts').insertAt(0, attempt);
                        this.get('currentUser').incrementProperty('numberOfAttempts');
                        this.store.createRecord('action', {
                            user: this.get('currentUser'),
                            type: 'attemptFinished',
                            test: attempt.get('test.content'),
                            attempt: attempt,
                            value: score
                        });
                    }
                }.bind(this));

            return;
        },

        enlargeQuestionImage: function () {
            this.set('modalImageUrl', this.get('currentQuestion.image.url'));
            this.send('openModal', 'application/modal/image', 'test');
        },

        readyToPrint: function () {
            var mywindow = window.open('', this.get('title'), 'height=400,width=600');
            mywindow.document.write('<html><head><title>'+this.get('title')+'</title>');
            /*optional stylesheet*/ //mywindow.document.write('<link rel="stylesheet" href="main.css" type="text/css" />');
            mywindow.document.write('</head><body >');
            mywindow.document.write($('#printView').html());
            mywindow.document.write('</body></html>');

            mywindow.print();
            mywindow.close();

            return true;
        }
    }

});
