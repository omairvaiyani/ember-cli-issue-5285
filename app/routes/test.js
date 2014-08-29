import
Ember
from
'ember';

export default
Ember.Route.extend({
    model: function (params) {
        var where = {
            "slug": params.test_slug
        };
        return this.store.findQuery('test', {where: JSON.stringify(where)})
            .then(function(results) {
                if(results) {
                    return results.objectAt(0);
                } else {
                    console.log("No test with this slug found");
                }
            });
    },
    setupController: function (controller, model) {
        model.get('questions').then(function(questions) {
            controller.set('model', model);
            /*
             * Create a new property which holds
             * a shuffled array of questions
             */
            controller.set('shuffledQuestions', this.shuffle(questions.get('content')));
            /*
             * Loop through each shuffled question and:
             * - Get the options which are not empty
             * - Shuffle the remaining options
             * - Set a new property in the question: shuffledOptions
             */
            controller.get('shuffledQuestions').forEach(function(question) {
                var nonEmptyOptions = [];
                question.get('options').forEach(function(option) {
                    if(option.phrase)
                        nonEmptyOptions.push(option);
                });
                question.set('shuffledOptions', this.shuffle(nonEmptyOptions));
            }.bind(this));
            /*
             * Allow page to display the test
             */
            controller.set('loading', null);
        }.bind(this));
    },
    shuffle: function (o) {
        for (var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
        return o;
    }
});
