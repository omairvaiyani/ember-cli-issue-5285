import Ember from 'ember';
import ParseHelper from '../utils/parse-helper';

export default Ember.Route.extend({
    model: function (params) {
        var attempt = this.store.all('attempt').filterBy('id', params.attempt_id).objectAt(0);

        if (attempt) {
            return attempt;
        }

        return ParseHelper.cloudFunction(this, 'getAttempt', {id: params.attempt_id})
            .then(function (response) {
                // Need to extract author, it's too deep to extract through the attempt
                var author = response.author;
                // Author only sent if different from currentUser
                if (author)
                    ParseHelper.extractRawPayload(this.store, 'parse-user', author);
                return ParseHelper.extractRawPayload(this.store, 'attempt', response.attempt);
            }.bind(this), function (error) {
                console.dir(error);
                // TODO switch template to 404
            });
    },

    setupController: function (controller, model) {
        controller.set('model', model);
        controller.setGoBackTo();
    }
});
