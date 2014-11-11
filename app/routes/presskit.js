import Ember from 'ember';

export default Ember.Route.extend({
    setupController: function (controller, model, transition) {
        transition.send('updatePageDescription', "Press Information for MyCQs. Company info, founder bios, images" +
        ", quotes and links can be found here.");
        transition.send('prerenderReady');
    }
});
