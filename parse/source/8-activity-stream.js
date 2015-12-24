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

/**
 * @Function Prepare Activity for Dispatch
 * @param {Object} activity
 * @returns {Object} activity
 */
function prepareActivityForDispatch(activity, currentUser) {
    // Minimise actor if not current user
    if (activity.actor_parse.id !== currentUser.id)
        activity.actor_parse = activity.actor_parse.minimalProfile();
    else
        activity.actor_parse = activity.actor_parse.toJSON(); // to avoid .get() functionality below

    // Activity title
    var title = activity.actor_parse.name;

    switch (activity.verb) {
        case "took quiz":
            title += " took " + activity.object_parse.test().title();
            break;
        case "followed":
            var following = activity.object_parse.following();
            if (following.id !== currentUser.id)
                activity.object_parse.following = following.minimalProfile();
            else
                activity.object_parse.following = following.toJSON();
            title += " started following " + activity.object_parse.following.name;
            break;
    }
    activity.title = title;
    return activity;
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
        var activities = httpResponse.data.results;
        return Parse.Cloud.run('enrichActivityStream', {activities: activities, user: request.user.toJSON()})
            .then(function (activities) {
                response.success({
                    activities: activities,
                    feed: feedIdentifier,
                    token: feed.token
                });
            }, function (error) {
                response.error(error);
            });
    }, GetstreamUtils.createHandler(logger, response));
});

Parse.Cloud.define('enrichActivityStream', function (request, response) {
    var activities = request.params.activities,
        currentUser = request.user ? request.user : request.params.user;

    if(!currentUser)
        return response.error("You must send current user.");

    logger.log("activity-stream", "user", currentUser);

    // enrich the response with the database values where needed

    var includes = {
        classNames: ["Attempt", "Test", "Follow"],
        Attempt: ["test"],
        Test: ["questions"],
        Follow: ["following"]
    };
    Parse.Cloud.useMasterKey();
    return GetstreamUtils.enrich(activities, includes, currentUser).then(function (enrichedActivities) {
        _.each(enrichedActivities, function (activity) {
            prepareActivityForDispatch(activity, currentUser);
        });

        response.success(enrichedActivities);
    }, function (error) {
        response.error(error);
    });
});