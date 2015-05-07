import Ember from 'ember';
import EventTracker from '../utils/event-tracker';

export default Ember.Route.extend({
    needs: ['test'],

    testController: function () {
        return this.get('controllers.test');
    }.property('controllers.test'),

    beforeModel: function () {
        this.controllerFor('test').set('loading', "Preparing test");
    },

    model: function (params, transition) {
        transition.send('incrementLoadingItems');
        var testSlug = params.test_slug,
            testOldId = params.test_slug,
            where = {
                "$or": [
                    {"slug": testSlug},
                    {"oldId": testOldId}
                ]
            };
        return this.store.findQuery('test', {where: JSON.stringify(where)})
            .then(function (results) {
                if (results.objectAt(0)) {
                    return results.objectAt(0);
                } else {
                    var generatedAttemptId = params.test_slug;
                    return this.store.findById('attempt', generatedAttemptId);
                }
            }.bind(this));
    },
    /*
     * Prerender readied in Test.Controller.setTimeStarted
     */
    setupController: function (controller, model) {
        if (!model) {
            this.transitionTo('notFound');
            return;
        }
        var isGeneratedAttempt = false;
        if (model.constructor.typeKey === 'attempt') {
            isGeneratedAttempt = true;
        } else {
            this.send('updatePageTitle', model.get('title'));
            var description = model.get('description');
            if (!description)
                description = "This mcq test on has " + model.get('totalQuestions') + " questions! Take it now for free!";
            this.send('updatePageDescription', description);
        }
        model.get('questions').then(function (questions) {
            /*
             * This ensures that the loadingItems
             * is at least 1 at this point.
             * On route transitions, sending actions
             * is buggy and therefore this is a backup call.
             */
            this.send('decrementLoadingItems');
            this.send('incrementLoadingItems');

            controller.set('model', model);
            controller.set('isGeneratedAttempt', isGeneratedAttempt);
            /*
             * Create a new property which holds
             * a shuffled array of questions
             */
            controller.set('shuffledQuestions', this.shuffle(questions));
            /*
             * Loop through each shuffled question and:
             * - Get the options which are not empty
             * - Shuffle the remaining options
             * - Set a new property in the question: shuffledOptions
             */

            controller.get('shuffledQuestions').forEach(function (question) {
                var nonEmptyOptions = [];
                /*
                 * Reset question.isAnswer and options.@each.isSelected to false
                 */
                question.set('isAnswered', false);
                if (question.get('options')) {
                    question.get('options').forEach(function (option) {
                        option.isSelected = false;
                        if (option.phrase)
                            nonEmptyOptions.push(option);
                    });
                }
                question.set('shuffledOptions', this.shuffle(nonEmptyOptions));
            }.bind(this));
            /*
             * Reset controller to Q1
             * Allow page to display the test
             */
            controller.set('currentQuestionIndex', 0);
            controller.set('loading', null);
            this.send('decrementLoadingItems');
        }.bind(this), function (error) {
            console.log(error);
            this.send('decrementLoadingItems');
        }.bind(this));
    },

    shuffle: function (o) {
        for (var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
        return o;
    }

});
