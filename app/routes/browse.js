import Ember from 'ember';
import RouteHistory from '../mixins/route-history';

export default Ember.Route.extend(RouteHistory, {
    model: function () {
        return this.store.all('category').filter(function (category) {
            return category.get('level') === 1;
        }).sortBy('name');
    },

    /*
     * // No longer true, removed dynamicGrid
     * * Prerender is readied in BrowseController.createDynamicGrid
     */
    setupController: function (controller, model, transition) {
        this.send('updatePageDescription', "Find thousands of MCQ tests in hundreds of " +
        "subjects. Medicine, Science, Math, Law, Aviation and lots more!");
        controller.set('model', model);

        // Send Route to RouteHistory
        var routePath = "browse",
            routeLabel = "Browse Quizzes";
        transition.send('addRouteToHistory', routePath, routeLabel, transition);

        this.send('prerenderReady');
    }
});
