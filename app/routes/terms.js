import Ember from 'ember';

export default Ember.Route.extend({
    setupController: function (controller) {
        if (controller.get('staticPageContent')) {
            /*
             * Hackaround given that the div doesn't load
             * at this point!
             */
            setTimeout(function () {
                $('#static-page').html(controller.get('staticPageContent'));
            }, 500);
            return;
        }
        var where = {
            slug: "terms"
        };
        this.store.findQuery('page', {where: JSON.stringify(where)})
            .then(function (result) {
                var page = result.objectAt(0);
                controller.set('staticPageContent', page.get('content'));
                $(document).ready(function () {
                    $('#static-page').html(controller.get('staticPageContent'));
                });
            });
    }
});
