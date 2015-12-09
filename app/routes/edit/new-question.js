import Ember from 'ember';

export default Ember.Route.extend({
    controllerName: 'editQuestion',

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

    actions: {
        refreshRoute: function() {
            this.refresh();
        }
    },

    deactivate: function() {
        this.controllerFor('edit-question').send('clearValidity');
    }
});
