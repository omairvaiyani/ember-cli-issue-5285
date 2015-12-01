import Ember from 'ember';
import ParseHelper from '../utils/parse-helper';

export default Ember.Route.extend({
    controllerName: ['onboarding'],

    model: function (params) {
        var betaActivationId = params["activate_beta_id"];
        return ParseHelper.cloudFunction(this, "betaInviteAccepted", {id: betaActivationId}).
        then(function (response) {
            return response.betaInvite;
        }, function (error) {
            console.dir(error);
            this.set("errorMessage", error.error);
        }.bind(this));
    },

    setupController: function (controller, model) {
        if (!model)
            controller.set("errorMessage", this.get('errorMessage') ? this.get('errorMessage') : "Something went wrong!");
        else {
            controller.set("betaInvite", model);
            localStorage.setItem("betaActivationId",  model.objectId);
            this.transitionTo('onboarding');

            var notification = {
                type: "success",
                title: "Beta Activated!"
            };
            this.send('addNotification', notification);
        }
    }
});
