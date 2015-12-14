import Ember from 'ember';

export default Ember.Mixin.create({
    newTag: "",

    addingTag: false,

    /**
     * @Deprecated
     * @Property Active Tags
     * Used to filter tests on page by tag.
     */
    activeTags: [],

    /**
     * @Deprecated
     * @Property Active Categories
     * Used to filter tests on page by category.
     */
    activeCategories: [],

    /**
     * @Deprecated
     * @Property filterActive
     */
    filterActive: function () {
        return this.get('activeTags.length') || this.get('activeCategories.length');
    }.property('activeTags.length', 'activeCategories.length'),

    actions: {
        /**
         * ADDING AND REMOVING TAGS
         */
        toggleAddingNewTag: function () {
            if (this.get('newTag.length')) {
                if (!this.get('model.tags')) {
                    // Unlikely, as CreateRoute.model sets this
                    this.set('model.tags', new Ember.A());
                }
                this.get('model.tags').pushObject(this.get('newTag'));
                this.set('newTag', "");
            }

            this.set('addingTag', !this.get('addingTag'));
            setTimeout(function () {
                if (this.get('addingTag'))
                    Ember.$("#new-tag").focus();
            }.bind(this), 150);
        },

        removeTag: function (tagIndex) {
            this.get('model.tags').removeAt(tagIndex);
        },

        /**
         * @Deprecated
         * @Action Toggle Tag Filter
         * Can be for filtering with multiple tags.
         * @param {String} tag
         */
        toggleTagFilter: function (tag) {
            if (!tag)
                return;

            if (_.contains(this.get('activeTags'), tag))
                this.get('activeTags').removeObject(tag);
            else
                this.get('activeTags').pushObject(tag);
        },

        /**
         * @Deprecated
         * @Action Toggle Category Filter
         * Can be for filtering with categories
         * Used by IndexController. Overridden
         * in CategoryController.
         * @param {Category} object
         */
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
