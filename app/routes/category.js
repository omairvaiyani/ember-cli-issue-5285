import
Ember
from
'ember';

export default
Ember.Route.extend({
    model: function (params, transition) {
        console.log("Changing model in Route.Category "+JSON.stringify(params));
        if(params.category_slug.toLowerCase() === "all")
            return {};

        var category;

        var where = {
            "slug": params.category_slug
        };
        return this.store.findQuery('category',
            {
                where: JSON.stringify(where),
                include: 'parent'
            }
        ).then(function (results) {
                if (results.objectAt(0)) {
                    return results.objectAt(0);
                } else {
                    return;
                }
            }.bind(this));
    },
    /*
     * Description and Prerender redied in CategoryController.pageIsLoadedCompletely
     * This is due to subcategories being params and not models
     * for the route.
     */
    setupController: function(controller, model) {
        if(!model) {
            this.transitionTo('notFound');
            return;
        }
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
        controller.set('browseAll', !model.id);
    }
});
