import Ember from 'ember';

export default Ember.Route.extend({
    model: function (params) {
        var attemptId = params.attempt_id;
        return this.store.findById('attempt', attemptId)
            .then(function(attempt) {

            })
    },

    renderTemplate: function() {
        this.render('test');
    }
});
