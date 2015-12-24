import Ember from 'ember';
import ParseHelper from '../../utils/parse-helper';

export default Ember.Route.extend({
    model: function () {
        var _this = this;

        return ParseHelper.cloudFunction(_this, 'fetchActivityFeed', {
            feed: 'flat:' + _this.controllerFor('application').get('currentUser.id')
        }).then(function (feed) {
            ParseHelper.prepareActivitiesForEmber(_this.store, feed.activities);
            return feed;
        });
    },

    setupController: function (controller, model) {
        controller.set('model', model);
        var feed = Ember.StreamClient.feed('flat', controller.get('currentUser.id'), model.token);
        controller.set('feed', feed);
    }
});
