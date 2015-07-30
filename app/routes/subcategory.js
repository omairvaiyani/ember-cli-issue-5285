import Ember from 'ember';

export default Ember.Route.extend({
    model: function (params) {
        var recordArray = this.store.all('category').filterBy('slug', params.subcategory_slug);
        if(recordArray.objectAt(0))
            return recordArray.objectAt(0);
        else
            console.error("category not found");
    },
    renderTemplate: function () {
        this.render('category');
    },
    controllerName: 'category',
    setupController: function (controller, model) {
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
            controller.set('alreadyGotChildCategories', false);
            controller.set('readyToGetTests', false);
        }
        controller.set('model', model);
    }
});
