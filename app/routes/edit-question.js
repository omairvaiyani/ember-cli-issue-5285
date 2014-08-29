import Ember from 'ember';

export default Ember.Route.extend({
    model: function(params) {
        return this.store.findById('question', params.question_id);
    },

    deactivate: function() {
        this.controllerFor('edit-question').send('clearValidity');
    }
});
