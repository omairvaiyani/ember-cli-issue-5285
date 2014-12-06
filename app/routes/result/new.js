import Ember from 'ember';

export default Ember.Route.extend({
    setupController: function (controller, model, transition) {
        var testController = this.controllerFor('test');
        if(!testController.get('unsavedAttempt'))
            this.transitionTo('notFound');
        else
            controller.set('model', testController.get('unsavedAttempt'));
    },

    controllerName: 'result',

    renderTemplate: function () {
        this.render('result');
    }
});
