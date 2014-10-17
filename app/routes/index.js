import
Ember
from
'ember';


export default
Ember.Route.extend({
    setupController: function(controller, model, transition) {
        controller.set('model', model);
        controller.set('initialized', true);
        transition.send('prerenderReady');
    }
});
