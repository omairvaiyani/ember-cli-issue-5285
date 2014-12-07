import Ember from 'ember';

export default Ember.Route.extend({
    model: function (params) {
        var where = {
                "slug": params.subcategory_slug
            };
        return this.store.findQuery('category',
            {
                where: JSON.stringify(where),
                include: 'parent'
            }
        ).then(function (results) {
                if (results.objectAt(0)) {
                    results.objectAt(0).get('parent');
                    return results.objectAt(0);
                } else {
                    return;
                }
            }.bind(this));
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
