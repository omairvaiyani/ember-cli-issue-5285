import Ember from 'ember';

export default Ember.Route.extend({
    model: function () {
        var initialOptions = [];
        for(var i = 0; i < 5; i++) {
            var option = {
                phrase: '',
                isCorrect: !i
            };
            initialOptions.push(option);
        }
        return this.store.createRecord('question', {
            options: initialOptions
        });
    },
    controllerName: 'editQuestion',
    setupController: function(controller, model) {
        controller.set('model', model);
    },
    actions: {
        refreshRoute: function() {
            this.refresh();
        }
    },
    deactivate: function() {
        this.controllerFor('edit-question').send('clearValidity');
    }
});
