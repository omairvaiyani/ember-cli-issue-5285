var _ = require('underscore');

function serializeId(parseObject) {
    /*
     * Returns ref:className:id
     */
    return 'ref:' + parseObject.className + ':' + parseObject.id;
};

exports.serializeId = serializeId;

function normalizeModelClass(className) {
    /*
     * Take a string value of a className and return something we can use in
     * A query
     */
    var modelClass = className;
    var map = {'_User': Parse.User};
    if (className in map) {
        modelClass = map[className];
    }
    return modelClass;
};
exports.normalizeModelClass = normalizeModelClass;

/**
 * @Function Parse To Activity
 *
 * @param {Parse.Object} parseObject
 * @returns {{}}
 */
exports.parseToActivity = function parseToActivity(activityObject) {
    /*
     * Take the parse activity and converts it into the required
     * activity information for getstream.io
     * The names are based on:
     * http://activitystrea.ms/specs/json/1.0/
     * Also see
     * http://getstream.io/docs
     */
    var activity = _.clone(activityObject);
    activity.actor = serializeId(activityObject.actor);

    if (activityObject.object)
        activity.object = serializeId(activityObject.object);

    activity.foreign_id = serializeId(activityObject.object ? activityObject.object : activityObject.actor);

    if (activityObject.target)
        activity.target = serializeId(activity.target);

    activity.feed_slug = 'user';
    activity.feed_user_id = activityObject.actor.id;

    if (activityObject.to) {
        var notificationArray = [];
        _.each(activityObject.to, function (to) {
            notificationArray.push('notification:' + to.id);
        });
        activity.to = notificationArray;
    }

    // time and foreign id together ensure uniqueness
    if (!activity.time && activity.object && activity.object.createdAt)
        activity.time = activityObject.object.createdAt.toISOString();
    else if (activity.actor && activity.actor.createdAt)
        activity.time = activity.actor.createdAt.toISOString();
    else
        activity.time = new Date().toISOString();

    return activity;
};

/**
 * @Function Enrich
 * @param {Array} activities
 * @param {Object} includes
 * @param {Parse.User} currentUser
 * @returns {*}
 */
function enrich(activities, includes, currentUser) {
    /*
     * Takes the given activities from getstream.io and looks up the needed
     * references from the parse database
     */
    // Find all the references and add them to the lookup object
    var lookup = {};
    var activityIds = [];
    _.each(activities, function (activity) {
        activityIds.push(activity.id);

        if (activity.group) {
            // Notification or Aggregate inner activities
            _.each(activity.activities, function (innerActivity) {
                _.each(innerActivity, function (value) {
                    if (value && value.indexOf('ref') === 0) {
                        var parts = value.split(':');
                        if (!(parts[1] in lookup)) {
                            lookup[parts[1]] = [];
                        }
                        lookup[parts[1]].push(parts[2]);
                    }
                });
            });
        }
        _.each(activity, function (value) {
            if (value && typeof value === "string" && value.indexOf('ref') === 0) {
                var parts = value.split(':');
                if (!(parts[1] in lookup)) {
                    lookup[parts[1]] = [];
                }
                lookup[parts[1]].push(parts[2]);
            }
        });

    });

    // we add all the necessary queries to this list of promises
    var promises = [];

    // Query which activities the user already likes
    if (currentUser) {
        var doILikeQuery = new Parse.Query('Like');
        doILikeQuery.containedIn('activityId', activityIds);
        doILikeQuery.equalTo('liker', currentUser);
        var likePromise = doILikeQuery.find();
        promises.push(likePromise);
    } else {
        var doILikeQuery = Parse.Promise.as([]);
        promises.push(doILikeQuery);
    }

    // Query all the needed data in parallel and wait for results
    _.each(lookup, function (ids, className) {
        var query = new Parse.Query(normalizeModelClass(className));
        query.containedIn("objectId", ids);
        if (_.contains(includes.classNames, className)) {
            _.each(includes[className], function (include) {
                query.include(include);
            });
        }
        var promise = query.find();
        promises.push(promise);
    });
    var all = Parse.Promise.when(promises);

    // Transform the queries into dictionaries
    // And add the data to the response
    var promise = all.then(function (doILikeResult) {
        // convert the do i like into an object
        var doILikeHash = {};
        if (doILikeResult.length) {
            _.each(doILikeResult, function (like) {
                var activityId = like.get('activityId');
                doILikeHash[activityId] = like;
            });
        }

        // create the result hash
        var resultSets = _.toArray(arguments).slice(1);

        var resultHash = {};
        _.each(resultSets, function (results) {
            if (results.length) {
                resultHash[results[0].className] = {};
                _.each(results, function (result) {
                    resultHash[result.className][result.id] = result;
                });
            }
        });

        // now we set the data
        _.each(activities, function (activity) {
            if (activity.group) {
                _.each(activity.activities, function (innerActivity) {
                    _.each(innerActivity, function (value, field) {
                        if (value && typeof value === "string" && value.indexOf('ref') === 0) {
                            var parts = value.split(':');
                            var parseModels = resultHash[parts[1]];
                            innerActivity[field] = parseModels && parseModels[parts[2]];
                        }
                        // set the innerActivity liked state
                        innerActivity.liked = innerActivity.id in doILikeHash;
                    });
                });
            }
            _.each(activity, function (value, field) {
                if (value && typeof value === "string" && value.indexOf('ref') === 0) {
                    var parts = value.split(':');
                    var parseModels = resultHash[parts[1]];
                    activity[field] = parseModels && parseModels[parts[2]];
                }
            });
            // set the liked state
            activity.liked = activity.id in doILikeHash;
        });
        return activities;
    }, function () {
        return new Parse.Promise().reject("failed to query the data needed for enrichment");
    });

    return promise;
}

exports.enrich = enrich;

function createHandler(logger, response) {
    /*
     * Default error handling behaviour for async requests
     */
    function errorHandler(result) {
        if (result && result.data && result.data.exception) {
            var msg = 'GetStream.io ' + result.data.exception + ':' + result.data.detail;
            console.error(msg);
            // afterSave doesnt have the response object available
            if (logger) {
                logger.log("activity-stream", "error", msg);
            }
            if (response) {
                response.error(msg);
            }
        } else {
            if (logger) {
                logger.log("activity-stream", "success", result.data);
            }
        }
    }

    return errorHandler;
}

exports.createHandler = createHandler;
