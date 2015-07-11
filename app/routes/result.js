import Ember from 'ember';
import EventTracker from  '../utils/event-tracker';
import ParseHelper from '../utils/parse-helper';

export default Ember.Route.extend({
    model: function (params) {
        var where = {
            "objectId": params.attempt_id
        };
        return ParseHelper.findQuery(this, 'Attempt', {where: where, include: "responses,questions"})
            .then(function (result) {
                console.dir(result);
                if (result.objectAt(0))
                    return result.objectAt(0);
                else
                    console.log("Result not found, handle it.");
            }, function (error) {
                console.dir(error);
            });
    },

    setupController: function (controller, model) {
        controller.set('model', model);
        if (this.controllerFor('test').get('savingResponses')) {
            model.get('responses')
                .then(function (responses) {
                    if (!responses.length)
                        responses.addObjects(this.controllerFor('test').get('responses'));
                }.bind(this));
        }
        EventTracker.recordEvent(EventTracker.VIEWED_RESULTS_PAGE, model);
    }
});
