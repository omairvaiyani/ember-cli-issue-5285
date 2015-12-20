import Ember from 'ember';
import CurrentUser from '../mixins/current-user';
import ParseHelper from '../utils/parse-helper';
import EventTracker from '../utils/event-tracker';

export default Ember.Controller.extend(CurrentUser, {
    loading: 'Preparing test...',

    setTimeStarted: function () {
        this.set('timeStarted', new Date());
        setTimeout(function () {
            this.send('prerenderReady');
        }.bind(this), 4000);
    }.on('init'),

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
        if (!this.get('model.slug'))
            return "";
        return "https://mycqs.com/test/" + this.get('model.slug');
    }.property('model.slug.length'),

    /**
     * Question Progress Bar
     */
    questionProgress: function () {
        return (this.get('questionsAnswered.length') / this.get('shuffledQuestions.length')) * 100;
    }.property('questionsAnswered.length', 'shuffledQuestions.length'),

    questionProgressStyle: function () {
        return "width: " + this.get('questionProgress') + "%;";
    }.property('questionProgress'),

    finishTestAlertMessage: function () {
        var message,
            totalQuestions = this.get('shuffledQuestions.length'),
            questionsAnswered = this.get('questionsAnswered.length'),
            questionsSkipped = totalQuestions - questionsAnswered;

        if (!questionsSkipped)
            message = "You have answered all " + this.get('shuffledQuestions.length') + " questions.";
        else if (questionsAnswered)
            message = "You have skipped " + questionsSkipped + " questions.";
        else
            message = "You have not answered any of the " + totalQuestions + " questions.";

        return message;
    }.property('shuffledQuestions.length', 'questionsAnswered.length'),

    /**
     * @Observer Check if Attempt and Responses Saved
     * This is part of the Mark Test flow,
     * see this.actions.markTest()
     */
    checkIfAttemptAndResponsesSaved: function () {
        if (this.get('attemptSaved') && this.get('responsesSaved')) {
            setTimeout(function () {
                // Issues with response array duplication
                // Timeout seems to sort this
                this.send('finaliseNewAttempt');
            }.bind(this), 1000);
        }
    }.observes('attemptSaved', 'responsesSaved'),

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

            setTimeout(function () {
                if (this.get('currentQuestionIndex') < (this.get('shuffledQuestions.length') - 1))
                    this.incrementProperty('currentQuestionIndex');
                else
                    this.send('confirmFinish');
            }.bind(this), 250);
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
            this.send('openModal', 'test/modals/finish-test', 'test');
        },
        /**
         * ---------
         * Mark Test
         * ---------
         * @Current being rewritten
         */
        isMarking: false,

        /**
         * @Action Mark Test
         *
         * Read carefully to understand flow
         * Flow 1a
         * - Attempt generated
         * - Score marked with responses generated
         * - Attempt saved WITHOUT responses
         * - Saved attempt set with unsaved responses
         * - Flow 2 primed
         * - *TRANSITION* to results page
         * Flow 1b
         * - Responses saved in batch call
         * - Flow 2 primed
         * Flow 2 (see this.checkIfAttemptAndResponsesSaved)
         * - Replaced saved responses with local unsaved responses on attempt
         * - Save attempt using REST
         * - Call finaliseNewAttempt for gamification purposes
         */
        markTest: function () {
            this.send('incrementLoadingItems');
            this.send('closeModal');
            this.set('loading', 'Marking test...');

            var attempt = this.store.createRecord('attempt', {
                test: this.get('model')
            });

            if (this.get('currentUser'))
                attempt.set('user', this.get('currentUser'));

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
                responsesArray = new Ember.A();

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
            attempt.set('score', Math.round(score));

            attempt.get('questions').addObjects(this.get('shuffledQuestions'));
            attempt.save().then(function () {
                this.set('attemptSaved', attempt);

                if (!attempt.get('response.length'))
                    attempt.get('responses').addObjects(responsesArray);
                this.transitionTo('result', attempt);

            }.bind(this), function (error) {
                console.error(error);
            }).then(function () {
                this.send('decrementLoadingItems');
            }.bind(this));

            ParseHelper.saveAll(this, 'Response', responsesArray).then(function (responses) {
                this.set('responsesSaved', responses);
            }.bind(this), function (error) {
                console.dir(error);
            });
        },

        /**
         * @Action Finalise New Attempt
         * Called from this.checkIfAttemptAndResponsesSaved()
         * Once attempt AND responses are separately saved,
         * this function is called to set the responses
         * onto the attempt and save it once more.
         *
         * A cloud code function is called to finalise
         * this attempt - gamification etc.
         *
         * By this point, the user is already viewing
         * their results - this happens in the background.
         */
        finaliseNewAttempt: function () {
            this.get('attemptSaved.responses').clear();
            this.get('attemptSaved.responses').addObjects(this.get('responsesSaved'));

            this.get('attemptSaved').save().then(function (attempt) {
                return ParseHelper.cloudFunction(this, 'finaliseNewAttempt', {
                    attemptId: attempt.get('id')
                });
            }.bind(this)).then(function (result) {
                // Update local attempt record
                var attempt = ParseHelper.extractRawPayload(this.store, 'attempt', result.attempt);
                this.get('currentUser.testAttempts').pushObject(attempt);
                // Update current-user record
                ParseHelper.extractRawPayload(this.store, 'parse-user', result.user);
            }.bind(this), function (error) {
                console.error(error);
            }).then(function () {
                this.set('attemptSaved', null);
                this.set('responsesSaved', null);
            }.bind(this));
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

})
;
