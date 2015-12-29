import Ember from 'ember';
import ParseHelper from '../../utils/parse-helper';

export default Ember.Route.extend({

    // Not using model, which allows us to display
    // a loader.
    setupController: function (controller, model) {
        controller.set('fetchingActivity', true);

        ParseHelper.cloudFunction(controller, 'fetchActivityFeed', {
            feed: 'flat:' + controller.get('currentUser.id')
        }).then(function (feedData) {
            ParseHelper.prepareActivitiesForEmber(controller.store, feedData.activities);
            controller.set('model', feedData);
            // Needed for listening for changes
            controller.set('feed', Ember.StreamClient.feed('flat', controller.get('currentUser.id'), feedData.token));
        }, function (error) {
            console.dir(error);
        }).then(function () {
            controller.set('fetchingActivity', false);
        });


    }
});
