import Ember from 'ember';
import ParseHelper from '../utils/parse-helper';
import EventTracker from '../utils/event-tracker';
import RouteHistory from '../mixins/route-history';

export default Ember.Route.extend(RouteHistory, {
    beforeModel: function () {
        this.controllerFor('test').set('loading', "Preparing test");
    },

    model: function (params, transition) {
        transition.send('incrementLoadingItems');

        var test = this.store.all('test').filterBy('slug', params.test_slug).objectAt(0);

        if (test && this.checkIfLocalTestHasQuestionsLoaded(test)) {
            return test;
        }

        return ParseHelper.cloudFunction(this, 'getCommunityTest', {slug: params.test_slug})
            .then(function (response) {
                return ParseHelper.extractRawPayload(this.store, 'test', response);
            }.bind(this), function (error) {
                console.dir(error);
                // TODO switch template to 404
            });

    },

    /**
     * @Function Check if Local Test has Questions Loaded
     *
     * In the model hook, we filter through local tests to
     * avoid unnecessary network calls. However, when the
     * website first initialises, we load created and saved
     * tests for the user *without* questions for latency.
     * Therefore, we need to check if the local test still
     * needs to result in the network call to fetch the whole
     * object (with questions).
     *
     * If we did test.get('questions.stem.length'), it would
     * result in automatic record fetching by ember-data. Yet,
     * Ember does not provide an official safe way to check
     * for relational records. Here's our "safe" workaround.
     *
     * @param test
     * @returns {boolean}
     */
    checkIfLocalTestHasQuestionsLoaded: function (test) {
        if (test._data && test._data.questions && test._data.questions[0] && test._data.questions[0]._data
            && test._data.questions[0]._data.stem)
            return true;
    },
    /*
     * Prerender readied in Test.Controller.setTimeStarted
     */
    setupController: function (controller, model, transition) {
        if (!model)
            return;

        var isGeneratedAttempt = false;

        if (model.constructor.typeKey === 'attempt') {
            isGeneratedAttempt = true;
        } else {
            this.send('updatePageTitle', model.get('title'));
            var description = model.get('description');
            if (!description)
                description = "This mcq test on has " + model.get('totalQuestions') + " questions! Take it now for free!";
            this.send('updatePageDescription', description);


            // Send Route to RouteHistory
            var routePath = "test",
                routeLabel = model.get('title');
            transition.send('addRouteToHistory', routePath, routeLabel, transition);
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
            controller.get('shuffledQuestions').clear();
            controller.get('shuffledQuestions').addObjects(this.shuffle(questions));
            /*
             * Loop through each shuffled question and:
             * - Get the options which are not empty
             * - Shuffle the remaining options
             * - Set a new property in the question: shuffledOptions
             */

            controller.get('shuffledQuestions').forEach(function (question) {
                var nonEmptyOptions = [];
                /*
                 * Reset question.isAnswered and options.@each.isSelected to false
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
