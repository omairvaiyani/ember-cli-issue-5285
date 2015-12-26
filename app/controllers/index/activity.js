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
            }).then(function (enrichedActivities) {
                // Better to delete here due to the delay
                // in enrichment (some activities are replaced
                // rather than deleted per se)
                if (data.deleted) {
                    _.each(data.deleted, function (id) {
                        _this.get('model.activities').removeObject(
                            _this.get('model.activities').findBy('id', id)
                        )
                    });
                }

                ParseHelper.prepareActivitiesForEmber(_this.store, enrichedActivities);
                _this.get('model.activities').unshiftObjects(enrichedActivities);
            });
        });
    }.observes('feed')
});
