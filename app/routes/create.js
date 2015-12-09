import Ember from 'ember';
import CurrentUser from '../mixins/current-user';
import RouteHistory from '../mixins/route-history';

export default Ember.Route.extend(CurrentUser, RouteHistory, {
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

        // Send Route to RouteHistory
        var routePath = "create",
            routeLabel = "Create a Quiz";
        transition.send('addRouteToHistory', routePath, routeLabel, transition);

        transition.send('prerenderReady');
    }
});
