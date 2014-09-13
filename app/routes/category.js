import
Ember
from
'ember';

export default
Ember.Route.extend({
    model: function (params) {
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
                if (results) {
                    category = results.objectAt(0);
                    if (category.get('level') === 1)
                        return category;
                    else {
                        /*
                         * Get category.parent and filter to this one
                         */
                        return this.store.findById('category', category._data.parent.id);
                    }
                } else {
                    console.log("No category with this slug found");
                }
            }.bind(this))
            .then(function (topLevelCategory) {
                if (topLevelCategory.get('slug') !== params.category_slug) {
                    this.transitionTo('category', topLevelCategory.get('slug'),
                        {queryParams: {categoryFilter: params.category_slug, page: 1}});
                }
                else
                    return topLevelCategory;
            }.bind(this));
    },

    setupController: function(controller, model) {
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
        }
        controller.set('model', model);
        controller.set('browseAll', !model.id);
    }
});
