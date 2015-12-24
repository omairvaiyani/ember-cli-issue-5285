/*
 * ACTIVITY STREAM
 */
/**
 * @Function Add Activity to Stream
 * @param {Parse.User} actor
 * @param {String} verb
 * @param {Parse.Object} object
 * @param {Array<Parse.User>} to
 * @returns {*}
 */
function addActivityToStream(actor, verb, object, to) {
    // trigger fanout
    var activity = GetstreamUtils.parseToActivity({
        actor: actor,
        verb: verb,
        object: object,
        to: to
    });

    logger.log("activity-stream", "activity to be fed", activity);
    console.error("activity -> " + JSON.stringify(activity));

    var feed = GetstreamClient.feed(activity.feed_slug, activity.feed_user_id);

    return feed.addActivity(activity, GetstreamUtils.createHandler(logger));
}

/*
 * View to retrieve the feed, expects feed in the format user:1
 * Accepts params
 *
 * feed: the feed id in the format user:1
 * limit: how many activities to get
 * id_lte: filter by activity id less than or equal to (for pagination)
 *
 */
Parse.Cloud.define("fetchActivityFeed", function (request, response) {
    var feedIdentifier = request.params.feed;
    var feedParts = feedIdentifier.split(':');
    var feedSlug = feedParts[0];
    var userId = feedParts[1];
    var id_lte = request.params.id_lte || undefined;
    var limit = request.params.limit || 100;
    var params = {
        limit: limit
    };
    if (id_lte) {
        params.id_lte = limit;
    }
    // initialize the feed class
    var feed = GetstreamClient.feed(feedSlug, userId);
    logger.log("activity-stream", "fetch feed", feed);
    Parse.Cloud.useMasterKey();
    feed.get(params, function (httpResponse) {
        var activities = httpResponse.data;
        // enrich the response with the database values where needed
        var promise = GetstreamUtils.enrich(activities.results, logger);
        promise.then(function (activities) {
            response.success({
                activities: activities,
                feed: feedIdentifier,
                token: feed.token
            });
        }, function (error) {
            response.error(error);
        });
        return promise;
    }, GetstreamUtils.createHandler(logger, response));
});