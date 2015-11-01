import Ember from 'ember';

export default Ember.Route.extend({
    setupController: function (controller, model, transition) {
        controller.set('model', model);
        controller.set('initialized', true);
        setTimeout(function () {
            // Allow page to load. Images can then be scraped by bots.
            transition.send('prerenderReady');
        }, 2000);
    },

    actions: {
        willTransition: function () {
            // For Video Resize on Guest Page
            $(".index-page-cover").off("resize", "**");

            // For Stats Counter Trigger on Guest Page
            $(window).off("scroll", "**");
        }
    }
});
