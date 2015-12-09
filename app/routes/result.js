import Ember from 'ember';
import ParseHelper from '../utils/parse-helper';

export default Ember.Route.extend({
    model: function (params) {
        var where = {
            "objectId": params.attempt_id
        };
        // TODO fetch using parse cloud code to get author
        return ParseHelper.findQuery(this, 'Attempt', {where: where, include: "responses,questions"})
            .then(function (result) {
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
        controller.setGoBackTo();
    }
});
