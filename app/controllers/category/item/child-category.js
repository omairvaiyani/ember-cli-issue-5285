import
Ember
from
'ember';

import
EachItem
from
'../../../mixins/each-item';

export default
Ember.ObjectController.extend(EachItem, {
    needs: 'category',

    categoryController: function () {
        return this.get('controllers.category');
    }.property('controllers.category'),

    categoryFilterSlugs: function () {
        return this.get('categoryController.categoryFilterSlugs');
    }.property('categoryController.categoryFilterSlugs.length'),

    isChecked: function () {
        if (this.get('categoryFilterSlugs').indexOf(this.get('model.slug')) > -1) {
            return true;
        }
        else {
            return false;
        }
    }.property('categoryFilterSlugs.length'),

    modelCheckChanged: function () {
        if (this.get('categoryFilterSlugs').indexOf(this.get('model.slug')) > -1) {
            this.set('isChecked', true);
        }
        else {
            this.set('isChecked', false);
        }
    }.observes('categoryFilterSlugs.length', 'categoryController.readyToGetTests'),

    viewCheckChanged: function () {
        if (this.get('isChecked')) {
            if(this.get('categoryFilterSlugs').contains(this.get('model.slug')))
                return;
            var categoryFilter = '';
            categoryFilter += this.get('categoryController.categoryFilter');
            if (categoryFilter.length)
                categoryFilter += ',';
            categoryFilter += this.get('model.slug');
            this.get('categoryController').transitionToRoute({queryParams:
                {categoryFilter: categoryFilter, page: 1}});
        } else {
            var isCurrent = false;
            if(this.get('categoryFilterSlugs').contains(this.get('model.slug'))) {
                isCurrent =true;

                var categoryFilterSlugs = [];
                categoryFilterSlugs.addObjects(this.get('categoryFilterSlugs'));
                categoryFilterSlugs.removeObject(this.get('model.slug'));
                var categoryFilter = '';
                for (var i = 0; i < categoryFilterSlugs.length; i++) {
                    categoryFilter += categoryFilterSlugs[i];
                    if (i < (categoryFilterSlugs.length - 1))
                        categoryFilter += ',';
                }
                this.get('categoryController').transitionToRoute({queryParams:
                    {categoryFilter: categoryFilter, page: 1}});
            }
        }
    }.observes('isChecked'),

    array: function () {
        return this.get('selectedCategories');
    }.property('selectedCategories.length')
});
