import Ember from 'ember';

export default Ember.Route.extend({
    model: function (params) {
        var recordArray = this.store.all('category').filterBy('slug', params.subcategory_slug);
        if (recordArray.objectAt(0))
            return recordArray.objectAt(0);
        else
            console.error("category not found");
    },
    renderTemplate: function () {
        this.render('category');
    },
    controllerName: 'category',

    controller: null,

    setupController: function (controller, model) {
        if (!model) {
            this.transitionTo('notFound');
            return;
        }
        // Need this for actions.willTransition
        this.set('controller', controller);

        var topLevelCategories = this.store.all('category').filterBy('level', 1).sortBy('name');
        controller.set('topLevelCategories', topLevelCategories);
        /*
         * These properties help avoid repetitive calls
         * to get childCategories for the same model.
         * Reset after model changes. Has to be called
         * before setting a new model which is being
         * observes by the 'getChildCategories' hook.
         */
        if (controller.get('model')) {
            controller.set('alreadyGotChildCategories', false);
            controller.set('readyToGetTests', false);
        }
        // Clear active categories in case there are any
        controller.get('activeCategories').forEach(function (category) {
            category.set('isActive', false);
        });
        controller.get('activeCategories').clear();
        // Set current model as active category
        controller.get('activeCategories').pushObject(model);
        model.set('isActive', true);

        controller.set('model', model);
    },

    actions: {
        // Clear currently active category as we are leaving route.
        willTransition: function () {
            var controller = this.get('controller');
            if(!controller)
                return;
            if (controller.get('activeCategories.length')) {
                var activeCategory = controller.get('activeCategories').objectAt(0);
                activeCategory.set('isActive', false);
                controller.get('activeCategories').clear();
            }
        }
    }
});
