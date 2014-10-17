import Ember from 'ember';

export default Ember.Route.extend({
    model: function (params, transition) {
        transition.send('incrementLoadingItems');
        var where = {
            level: 1
        };
        return this.store.findQuery('category', {where: JSON.stringify(where), order: "name"});
    },

    /*
     * Prerender is readied in BrowseController.createDynamicGrid
     */
    setupController: function (controller, model) {
        this.send('updatePageDescription', "Find thousands of MCQ tests in hundreds of subjects. Medicine, Science, Math, Law, Aviation and lots more!");
        controller.set('model', model);
    }
});
