import Ember from 'ember';
import RouteHistory from '../../mixins/route-history';

export default Ember.Route.extend(RouteHistory, {
    setupController: function (controller, model, transition) {
        // Send Route to RouteHistory
        var routePath = "index.progress",
            routeLabel = "Your Progress";

        transition.send('addRouteToHistory', routePath, routeLabel, transition);
    }
});
