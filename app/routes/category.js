import Ember from 'ember';
import RouteHistory from '../mixins/route-history';

export default Ember.Route.extend(RouteHistory, {
    model: function (params, transition) {
        if(params.category_slug.toLowerCase() === "all")
            return {browseAll: true};
        var recordArray = this.store.all('category').filterBy('slug', params.category_slug);
        if(recordArray.objectAt(0))
            return recordArray.objectAt(0);
    },
    /*
     * Description and Prerender redied in CategoryController.pageIsLoadedCompletely
     * This is due to subcategories being params and not models
     * for the route.
     */
    setupController: function(controller, model, transition) {
        if(!model) {
            this.transitionTo('notFound');
            return;
        }

        var topLevelCategories = this.store.all('category').filterBy('level', 1).sortBy('name');
        controller.set('topLevelCategories', topLevelCategories);
        /*
         * These properties help avoid repetitive calls
         * to get childCategories for the same model.
         * Reset after model changes. Has to be called
         * before setting a new model which is being
         * observes by the 'getChildCategories' hook.
         */
        if(controller.get('model')) {
            controller.set('alreadyGotChildCategoriesForBrowseAll', false);
            controller.set('alreadyGotChildCategories', false);
            controller.set('readyToGetTests', false);
        }

        controller.set('model', model);
        var routePath = "category",
            routeLabel;

        if(model && !model.browseAll && model.get('distinctName')) {
            // Send Route to RouteHistory
             routeLabel = model.get('distinctName') + " Quizzes";
        } else {
            // Send Route to RouteHistory
            routeLabel = "Searching Quizzes";
            var searchTerm = transition.queryParams.searchTerm;
            if(searchTerm) {
                routeLabel = "Searching '" + searchTerm + "'";
            }
        }
        transition.send('addRouteToHistory', routePath, routeLabel, transition, 'category_slug');

        controller.set('browseAll', !model.id);
    }
});
