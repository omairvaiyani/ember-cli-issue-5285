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

    filterCategories: function () {
        return this.get('categoryController.filterCategories');
    }.property('categoryController.filterCategories.length'),

    isChecked: function () {
        if (this.get('filterCategories').indexOf(this.get('model.id')) > -1) {
            return true;
        }
        else {
            return false;
        }
    }.property('filterCategories.length'),

    modelCheckChanged: function () {
        if (this.get('filterCategories').indexOf(this.get('model.id')) > -1) {
            this.set('isChecked', true);
        }
        else {
            this.set('isChecked', false);
        }
    }.observes('filterCategories.length', 'categoryController.readyToGetTests'),

    viewCheckChanged: function () {
        if (this.get('isChecked')) {
            if(this.get('filterCategories').contains(this.get('model.id')))
                return;
            var filterCategoryIds = '';
            filterCategoryIds += this.get('categoryController.filterCategoryIds');
            if (filterCategoryIds.length)
                filterCategoryIds += '-';
            filterCategoryIds += this.get('model.id');
            this.get('categoryController').transitionToRoute({queryParams:
                {filterCategoryIds: filterCategoryIds, page: 1}});
        } else {
            var isCurrent = false;
            if(this.get('categoryController.filterCategories').contains(this.get('model.id'))) {
                isCurrent =true;
                console.log("Unchecked: "+ this.get('model.id'));

                var filterCategories = [];
                filterCategories.addObjects(this.get('categoryController.filterCategories'));
                filterCategories.removeObject(this.get('model.id'));
                var filterCategoryIds = '';
                for (var i = 0; i < filterCategories.length; i++) {
                    filterCategoryIds += filterCategories[i];
                    if (i < (filterCategories.length - 1))
                        filterCategoryIds += '-';
                }
                this.get('categoryController').transitionToRoute({queryParams:
                    {filterCategoryIds: '', page: 1}});
            }
        }
    }.observes('isChecked'),

    array: function () {
        return this.get('selectedCategories');
    }.property('selectedCategories.length')
});
