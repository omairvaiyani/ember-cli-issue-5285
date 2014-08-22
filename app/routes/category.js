import
Ember
from
'ember';

export default
Ember.Route.extend({
    model: function (params) {
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
                if (topLevelCategory.get('slug') !== category.get('slug'))
                    this.transitionTo('category', topLevelCategory.get('slug'),
                        {queryParams: {filterCategoryIds: category.get('id')}});
                else
                    return topLevelCategory;
            }.bind(this));
    }
});
