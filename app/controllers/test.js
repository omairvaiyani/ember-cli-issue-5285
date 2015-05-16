import Ember from 'ember';
import CurrentUser from '../mixins/current-user';
import ParseHelper from '../utils/parse-helper';
import EventTracker from '../utils/event-tracker';

export default Ember.Controller.extend(CurrentUser, {
    loading: 'Preparing test...',

    setTimeStarted: function () {
        if (!this.get('preparingTest')) {
            this.set('timeStarted', new Date());
            this.send('prerenderReady');
            setTimeout(function () {
                EventTracker.recordEvent(EventTracker.STARTED_TEST, this.get('model'), this.get('currentUser'));
            }.bind(this), 1000);
        }
    }.observes('preparingTest'),

    modal: {
        title: "",
        message: "",
        suggestions: "",
        error: false
    },

    shuffledQuestions: new Ember.A(),

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

    testUrl: function () {
        if(!this.get('model.slug'))
            return "";
        return "https://mycqs.com/test/" + this.get('model.slug');
    }.property('model.slug.length'),

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
            if (!this.get('isGeneratedAttempt')) {
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
                    /*
                    if (this.get('currentUser.zzishActivityId:' + EventTracker.STARTED_TEST)) {
                        Zzish.logAction(this.get('currentUser.zzishActivityId:' + EventTracker.STARTED_TEST),
                            question.get('stem'), 1);
                    }*/
                }
                /*
                if (this.get('currentUser.zzishActivityId:' + EventTracker.STARTED_TEST)) {
                    var biScore = 0;
                    if (isCorrect)
                        biScore = 1;
                    Zzish.logAction(this.get('currentUser.zzishActivityId:' + EventTracker.STARTED_TEST),
                        question.get('stem'), chosenAnswer, biScore);
                }*/

                // Storing options in array as we may have
                // multiple correct options in the future
                var response = this.store.createRecord('response', {
                    chosenOptions: [chosenAnswer],
                    correctOptions: [correctAnswer],
                    question: question,
                    isCorrect: isCorrect,
                    test: attempt.get('test')
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
                    //responses.addObjects(responsesArray);
                    //console.dir({responsesArray: responsesArray, responses: responses,
                    //    attemptResponses: attempt.get('responses')});
                    return ParseHelper.cloudFunction(this, 'saveTestAttempt', {attempt: attempt, responses: responsesArray});
                }.bind(this))
                .then(function (result) {
                    console.dir(result);
                    var attempt = ParseHelper.extractRawPayload(this.store, 'attempt', result.attempt);
                    console.dir(attempt);
                    this.set('unsavedAttempt', attempt);
                    this.transitionToRoute('result.new');
                    this.send('decrementLoadingItems');
                }.bind(this));

           /* var arrayOfPromises = [];
            responsesArray.forEach(function (response) {
                arrayOfPromises.push(response.save());
            });
            Em.RSVP.Promise.all(arrayOfPromises).then(function (result) {
                //savedResponses = result;
                return attempt.save();
            }.bind(this))
                .then(function () {
                    //EventTracker.recordEvent(EventTracker.COMPLETED_TEST, attempt, this.get('currentUser'));
                    if (this.get('currentUser')) {
                        if (this.get('currentUser.attempts'))
                            this.get('currentUser.attempts').insertAt(0, attempt);
                        this.get('currentUser').incrementProperty('numberOfAttempts');
                        this.store.createRecord('action', {
                            user: this.get('currentUser'),
                            type: 'attemptFinished',
                            test: attempt.get('test'),
                            attempt: attempt,
                            value: score
                        });
                        *//*if (this.get('currentUser.zzishActivityId:' + EventTracker.STARTED_TEST)) {
                            var passed = score > 50;
                            if (passed)
                                passed = "Passed";
                            else
                                passed = "Failed";
                            Zzish.logAction(this.get('currentUser.zzishActivityId:' + EventTracker.STARTED_TEST),
                                "Finished test", passed, score);
                        }*//*
                    }
                }.bind(this));*/
        },

        enlargeQuestionImage: function () {
            this.set('modalImageUrl', this.get('currentQuestion.image.url'));
            this.send('openModal', 'application/modal/image', 'test');
        },

        readyToPrint: function () {
            var mywindow = window.open('', this.get('model.title'), 'height=400,width=600');
            mywindow.document.write('<html><head><title>' + this.get('model.title') + '</title>');
            /*optional stylesheet*/ //mywindow.document.write('<link rel="stylesheet" href="main.css" type="text/css" />');
            mywindow.document.write('</head><body >');
            mywindow.document.write($('#printView').html());
            mywindow.document.write('</body></html>');

            mywindow.print();
            mywindow.close();

            return true;
        },

        saveProfessionalTest: function (callback) {
            var test = this.store.createRecord('test');
            test.set('author', this.get('currentUser'));
            test.set('isProfessional', true);
            test.set('title', this.get('testTitle'));
            test.set('group', this.get('selectedGroup'));
            if (!test.get('group.id.length'))
                test.set('privacy', 0);
            else
                test.set('privacy', 1);
            test.set('isGenerated', true);
            test.get('questions').addObjects(this.get('model.questions'));
            var promise = test.save();
            callback(promise);
            promise.then(function () {
                this.set('test', test); // So we can tell this attempt has been saved as a test
                this.get('model').save();
            }.bind(this));
        }
    }

});
