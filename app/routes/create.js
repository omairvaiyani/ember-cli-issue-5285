import Ember from 'ember';
import CurrentUser from '../mixins/current-user';

export default Ember.Route.extend(CurrentUser, {
    model: function () {
        return this.store.createRecord('test');
    },

    setupController: function(controller, model, transition) {
        controller.set('model', model);
        transition.send('updatePageDescription', "Create MCQ tests using our free, online test maker platform. You can create"+
        " private tests for your revision, or share tests with friends, colleagues or students!");
        transition.send('prerenderReady');
    }
});
