import Ember from 'ember';
import RouteHistory from '../../mixins/route-history';

export default Ember.Route.extend(RouteHistory, {
    controllerName: 'index',

    setupController: function (controller, model, transition) {
        // Send Route to RouteHistory
        var routePath = "index.index",
            routeLabel;

        if (controller.get('currentUser')) {
            routeLabel = "My Home";
        } else {
            routeLabel = "Synap Home";
        }

        transition.send('addRouteToHistory', routePath, routeLabel, transition);
    }
});
