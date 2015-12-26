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

            if (data.deleted) {
                console.dir(data.deleted);
                _.each(data.deleted, function (id) {
                    _this.get('model.activities').removeObject(
                        _this.get('model.activities').findBy('id', id)
                    )
                });
            }

            ParseHelper.cloudFunction(_this, 'enrichActivityStream', {
                activities: data.new
            }).then(function (enrichedActivities) {
                ParseHelper.prepareActivitiesForEmber(_this.store, enrichedActivities);
                _this.get('model.activities').unshiftObjects(enrichedActivities);
            });
        });
    }.observes('feed')
});
