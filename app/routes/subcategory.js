import Ember from 'ember';

export default Ember.Route.extend({
    model: function (params) {
        var where = {
                "slug": params.subcategory_slug
            },
            category;
        return this.store.findQuery('category',
            {
                where: JSON.stringify(where),
                include: 'parent'
            }
        ).then(function (results) {
                if (results.objectAt(0)) {
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
                    return;
                }
            }.bind(this))
            .then(function (topLevelCategory) {
                if (!topLevelCategory)
                    return null;

                if (topLevelCategory.get('slug') !== params.subcategory_slug) {
                    this.transitionTo('category', topLevelCategory.get('slug'),
                        {queryParams: {categoryFilter: params.subcategory_slug, page: 1}});
                }
                else
                    return topLevelCategory;
            }.bind(this));
    },
    renderTemplate: function () {
        this.render('category');
    }
});
