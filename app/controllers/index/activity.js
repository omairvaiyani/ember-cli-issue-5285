import Ember from 'ember';
import CurrentUser from '../../mixins/current-user';
import ParseHelper from '../../utils/parse-helper';

export default Ember.Controller.extend(CurrentUser, {
    listenToFeed: function () {
        var feed = this.get('feed');
        if (!feed)
            return;
        var _this = this;
        feed.subscribe(function callback(data) {
            ParseHelper.cloudFunction(_this, 'enrichActivityStream', {
                activities: data.new
            }).then(function (activities) {
                ParseHelper.prepareActivitiesForEmber(_this.store, activities);
                _this.get('model.activities').unshiftObjects(activities);
            });
        });
    }.observes('feed')
});
