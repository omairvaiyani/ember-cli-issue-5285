import Ember from 'ember';
import CurrentUser from '../mixins/current-user';

export default Ember.Route.extend(CurrentUser, {
    model: function () {
        var newTest = this.store.createRecord('test');
        newTest.set('tags', new Ember.A());
        newTest.set('category', undefined);
        return newTest;
    },

    setupController: function(controller, model, transition) {
        controller.set('model', model);
        transition.send('updatePageDescription', "Create MCQ tests using our free, online test maker platform. You can create"+
        " private tests for your revision, or share tests with friends, colleagues or students!");
        transition.send('prerenderReady');
    }
});
