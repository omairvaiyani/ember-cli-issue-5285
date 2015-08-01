import Ember from 'ember';

export default Ember.Mixin.create({
    /**
     * @Property Active Tags
     * Used to filter tests on page by tag.
     */
    activeTags: [],

    /**
     * @Property Active Categories
     * Used to filter tests on page by category.
     */
    activeCategories: [],


    actions: {
        toggleTagFilter: function (tag) {
            if (!tag)
                return;

            if (_.contains(this.get('activeTags'), tag))
                this.get('activeTags').removeObject(tag);
            else
                this.get('activeTags').pushObject(tag);
        },

        toggleCategoryFilter: function (object) {
            var category = object.get('content') ? object.get('content') : object;
            if (!category)
                return;

            if (_.contains(this.get('activeCategories'), category)) {
                this.get('activeCategories').removeObject(category);
            } else {
                this.get('activeCategories').pushObject(category);
            }
            category.set('isActive', _.contains(this.get('activeCategories'), category));
        }
    }
});
