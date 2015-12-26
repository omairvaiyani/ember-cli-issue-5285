/*
 * ACTIVITY STREAM
 */
/**
 * @Function Add Activity to Stream
 * @param {Parse.User} actor
 * @param {String} verb
 * @param {Parse.Object} object
 * @param {Array<Parse.User>} to
 * @param {Parse.Object} target
 * @returns {*}
 */
function addActivityToStream(actor, verb, object, to, target) {
    // trigger fanout
    var activity = GetstreamUtils.parseToActivity({
        actor: actor,
        verb: verb,
        object: object,
        to: to,
        target: target
    });

    logger.log("activity-stream", "activity to be fed", activity);

    var feed = GetstreamClient.feed(activity.feed_slug, activity.feed_user_id);

    return feed.addActivity(activity, GetstreamUtils.createHandler(logger));
}

/**
 * @Function Prepare Activity for Dispatch
 *
 * - Minimised any non-self user profiles
 * - Creates a useful title for display
 * - Sets a flag on activities without the
 *   necessary parse objects, so that
 *   they can be deleted by the Cloud
 *   Function which called this function.
 *
 * @param {Object} activity
 * @param {Parse.User} currentUser
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
            if (!activity.target_parse) {
                activity.shouldBeRemoved = true;
                return activity;
            }
            title += " took " + activity.target_parse.title();
            break;
        case "followed":
            if (!activity.object_parse || (currentUser.id === activity.object_parse.following().id)) {
                activity.shouldBeRemoved = true;
                return activity;
            }
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

/**
 * @Function Prepare Grouped Activity for Dispatch
 * @param {Array} groupedActivity
 * @param {Parse.User} currentUser
 * @return {Array} groupedActivities
 */
function prepareGroupedActivityForDispatch(groupedActivity, currentUser) {
    _.each(groupedActivity.activities, function (activity) {
        prepareActivityForDispatch(activity, currentUser);
    });
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
    logger.log("activity-stream", "fetching feed", feed);
    Parse.Cloud.useMasterKey();
    feed.get(params, function (httpResponse) {
        var activities = httpResponse.data.results,
            unread = httpResponse.data.unread,
            unseen = httpResponse.data.unseen;
        logger.log("activity-stream", "feed data", httpResponse.data);

        var preparedActivities = [];
        return Parse.Cloud.run('enrichActivityStream', {activities: activities, user: request.user.toJSON()})
            .then(function (activities) {
                var removeActivitiesPromise = [];
                _.each(activities, function (activity) {
                    if (activity.shouldBeRemoved) {
                        removeActivitiesPromise.push(feed.removeActivity({
                            foreignId: activity.foreign_id
                        }, GetstreamUtils.createHandler(logger)))
                    } else {
                        preparedActivities.push(activity);
                    }
                });
                return Parse.Promise.when(removeActivitiesPromise);
            }).then(function () {
                response.success({
                    activities: preparedActivities,
                    feed: feedIdentifier,
                    token: feed.token,
                    unread: unread,
                    unseen: unseen
                });
            }, function (error) {
                response.error(error);
            });
    }, GetstreamUtils.createHandler(logger, response));
});

Parse.Cloud.define('enrichActivityStream', function (request, response) {
    var activities = request.params.activities,
        currentUser = request.user ? request.user : request.params.user;

    if (!currentUser)
        return response.error("You must send current user.");

    // enrich the response with the database values where needed

    var includes = {
        classNames: ["Test", "Follow"],
        Test: ["questions", "author"],
        Follow: ["following"]
    };
    Parse.Cloud.useMasterKey();
    return GetstreamUtils.enrich(activities, includes, currentUser).then(function (enrichedActivities) {

        // Prepare each activity (and inner activities for grouped feeds) for dispatch
        // Check each activity (and inner) if they need removing, set a remove flag
        _.each(enrichedActivities, function (activity) {
            if (activity.group)
                prepareGroupedActivityForDispatch(activity, currentUser);
            else
                prepareActivityForDispatch(activity, currentUser);
        });

        response.success(enrichedActivities);
    }, function (error) {
        response.error(error);
    });
});