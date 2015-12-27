/*
 * SAVE LOGIC
 */

/**
 * @beforeSave Parse.User
 *
 * New user:
 * - Set default parameters
 * - Generate slug (async)
 *
 */
Parse.Cloud.beforeSave(Parse.User, function (request, response) {
    var user = request.object,
        promises = [];

    if (user.isNew()) {
        user.setDefaults();
        promises.push(user.assignBadgeProgressions());
        promises.push(user.generateSlug());
    } else {
        if (user.dirtyKeys() && _.contains(user.dirtyKeys(), "email")) {
            user.username = user.get('email');
        }
    }
    Parse.Promise.when(promises).then(function () {
        response.success();
    }, function (error) {
        response.error(error);
    });
});


/**
 * @afterSave Parse.User
 *
 * New user:
 * - Set ACL
 */
Parse.Cloud.afterSave(Parse.User, function (request) {
    var user = request.object,
        promises = [];

    Parse.Cloud.useMasterKey();
    if (!user.existed()) {
        // ACLs can only be set after the first save
        // Hashes for Intercom can be created here
        var userACL = new Parse.ACL(user);
        userACL.setPublicReadAccess(false);
        userACL.setRoleReadAccess("admin", true);
        userACL.setRoleWriteAccess("admin", true);
        user.setACL(userACL);
        // Need a hash for secure client-intercom messaging
        // NOTE: storing as string might not work?
        user.set('intercomHash', CryptoJS.SHA256(user.id, intercomKey).toString());
        promises.push(user.save());

        // Notify Facebook Friends About Joining Synap
        // ** We also create the join activity here, so call this function
        // Regardless of whether this is a fb user or not! **
        promises.push(taskCreator('Notifications', TASK_NOTIFY_FACEBOOK_FRIENDS_ABOUT_JOIN, {}, [user]));
    } else {
        // Old user
        if (!user.get('intercomHash')) {
            // Only needed whilst testing, previous statement suffice
            user.set('intercomHash', CryptoJS.SHA256(user.id, intercomKey).toString());
            promises.push(user.save());
        }
    }
    // Add/Update search index (async)
    promises.push(user.indexObject());
    return Parse.Promise.when(promises);
});
/**
 * @afterDelete User
 * Removes from search index.
 */
Parse.Cloud.afterDelete(Parse.User, function (request) {
    var user = request.object,
        promises = [];

    promises.push(userIndex.deleteObject(user.id));
    promises.push(removeActivityFromStream("all", user, user));

    var followerQuery = new Parse.Query(Follow);
    followerQuery.equalTo('user', user);

    var followingQuery = new Parse.Query(Follow);
    followingQuery.equalTo('following', user);

    var followQuery = Parse.Query.or(followerQuery, followingQuery);
    var followDeletePromise = followQuery.find().then(function (follow) {
        return Parse.Object.destroyAll(follow);
    });
    promises.push(followDeletePromise);
    return Parse.Promise.when(followDeletePromise);
});

/**
 * @beforeSave Test
 *
 * New test:
 * - Set default parameters + ACL
 * - Generate slug (async)
 *
 * Existing test:
 * - Issue with deleted questions not being removed
 * due to __AddUnique REST call. Here we check if
 * a question should be removed from the test.
 */
Parse.Cloud.beforeSave(Test, function (request, response) {
    var test = request.object,
        user = request.user,
        promises = [];

    if (test.isNew()) {
        test.setDefaults();

        if (!test.isGenerated() && test.title() && user && !test.slug()) {
            promises.push(test.generateSlug(user));
        }
    } else {
        // Existing test
        test.set('totalQuestions', test.questions().length);

        if (_.contains(test.dirtyKeys(), "isPublic")) {
            // publicity has changed, so update that on
            // the questions within the test.
            _.each(test.questions(), function (question) {
                // Not setting this up as task as users
                // might toggle publicity too quickly.
                question.set('isPublic', test.isPublic());
                question.save();
            });
            // If publicity is now private, remove from search index.
            if (!test.isPublic()) {
                promises.push(test.deleteIndexObject());
                promises.push(removeActivityFromStream(test.author().id, test.author(), test));
            }
            var ACL = test.getACL();
            ACL.setPublicReadAccess(test.isPublic());
            test.setACL(ACL);
        }
    }

    Parse.Promise.when(promises).then(function () {
        response.success();
    }, function (error) {
        response.error(error);
    });
});

/**
 * @afterSave Test
 *
 */
Parse.Cloud.afterSave(Test, function (request) {
    var test = request.object,
        promises = [];

    if (!test.existed()) {
        // New test logic
    } else {
        // Existing test logic
    }
    if (test.isPublic()) {
        // Add/Update search index (async)
        promises.push(test.indexObject());
    } else {
        // Object will be removed from search index
        // and activity stream in beforeSave
    }
    return Parse.Promise.when(promises);
});

/**
 * @afterDelete Test
 * Removes from search index.
 */
Parse.Cloud.afterDelete(Test, function (request) {
    var test = request.object,
        user = request.user,
        promises = [];

    promises.push(testIndex.deleteObject(test.id));

    var currentUser = user ? user : test.author();
    if (currentUser)
        promises.push(removeActivityFromStream(test.author().id, test.author(), test));

    return Parse.Promise.when(promises);
});

/**
 * @beforeSave Question
 *
 * New Question:
 * - Set default parameters + ACL
 *
 */
Parse.Cloud.beforeSave(Question, function (request, response) {
    var question = request.object,
        user = request.user,
        promises = [];

    if (question.isNew()) {
        question.setDefaults(user);
    }
    // Update ACL each time.
    var ACL = question.getACL();
    ACL.setPublicReadAccess(question.isPublic());
    question.setACL(ACL);

    Parse.Promise.when(promises).then(function () {
        response.success();
    }, function (error) {
        response.error(error);
    });
});

/**
 * @beforeSave Attempt
 *
 * New Attempt:
 * - Set default parameters + ACL
 *
 */
Parse.Cloud.beforeSave(Attempt, function (request, response) {
    var attempt = request.object,
        promises = [];

    if (attempt.isNew()) {
        promises.push(attempt.setDefaults());
    }

    if (!attempt.isFinalised() && attempt.responses().length) {
        var ACL = attempt.getACL();
        ACL.setWriteAccess(attempt.user(), false);
        attempt.setACL(ACL);
        attempt.set('isFinalised', true);
    }

    Parse.Promise.when(promises).then(function () {
        response.success();
    }, function (error) {
        response.error(error);
    });
});


/**
 * @afterSave Attempt
 *
 * New Attempt:
 * - Set task for test stats to be updated
 * - Update user attempts relations
 */
Parse.Cloud.afterSave(Attempt, function (request) {
    var attempt = request.object,
        user = request.user,
        promises = [];

    if (!attempt.existed()) {
        // Test stats will be updated within 60 seconds
        var taskCreatorPromise = taskCreator('Statistics', TASK_UPDATE_TEST_STATS_AFTER_ATTEMPT,
            {}, [attempt.test(), attempt.questions(), attempt, user]);

        var userUpdatePromise = attempt.test().fetchIfNeeded().then(function (test) {
            // All Spaced Rep attempts go here
            if (test.isSpacedRepetition()) {
                user.srCompletedAttempts().add(attempt);
                // user.srLatestTestIsTaken dictates if a new sr test will be generated or not
                // safety net: check if srLatestTest is set on user
                if (!user.get('srLatestTest') || test.id === user.get('srLatestTest').id)
                    user.set('srLatestTestIsTaken', true);
            }
            // All other non-generated attempts go here
            else if (!test.isGenerated())
                user.testAttempts().add(attempt);

            // Find previous 'latestTestAttempts' for this test+user
            var latestAttemptsQuery = user.latestTestAttempts().query();
            latestAttemptsQuery.equalTo('test', test);
            return latestAttemptsQuery.find();
        }).then(function (previousAttempts) {
            // Ideally, there should be 0 or 1 previousAttempts.
            // But if a bug caused multiple previousAttempts on the
            // same test, we'll make sure they're removed in this
            // instance.
            _.each(previousAttempts, function (previousAttempt) {
                user.latestTestAttempts().remove(previousAttempt);
            });
            // Add this new attempt as the latest
            user.latestTestAttempts().add(attempt);
            return user.save();
            /*
             TODO remove this once set up on afterSave.UserEvent
             promises.push(updateActivityStream(request, {
             actor: user,
             object: attempt.test(),
             feedSlug: "user",
             feedUserId: attempt.user().id,
             verb: "took quiz",
             to: attempt.test().author(),
             score: attempt.score()
             }));*/

        });

        promises.push(taskCreatorPromise);
        promises.push(userUpdatePromise);
    }
    Parse.Promise.when(promises);
});

/**
 * @beforeSave Response
 *
 * New Response:
 * - Set default parameters + ACL
 *
 */
Parse.Cloud.beforeSave(Response, function (request, response) {
    var responseObject = request.object,
        promises = [];

    if (responseObject.isNew()) {
        responseObject.setDefaults();
    }

    Parse.Promise.when(promises).then(function () {
        response.success();
    }, function (error) {
        response.error(error);
    });
});

/**
 * @beforeSave UniqueResponse
 *
 * New UniqueResponse:
 * - Update response.question with unique stats
 * Else if new response is added:
 * - Update response.question with non-unique stats
 */
Parse.Cloud.beforeSave(UniqueResponse, function (request, response) {
    var uniqueResponse = request.object,
        user = request.user,
        promises = [];

    //  We only want to update question stats when new response is added.
    //  URs can be saved during background jobs, therefore, check dirtyKeys
    //  number of responses has changed.
    if (_.contains(uniqueResponse.dirtyKeys(), "numberOfResponses")) {
        uniqueResponse.setDefaults(user);

        var questionPromise = uniqueResponse.question().fetchIfNeeded()
            .then(function (question) {
                if (question) {
                    question.addNewResponseStats(uniqueResponse.latestResponseIsCorrect(), uniqueResponse.isNew());
                    return question.save(null, {useMasterKey: true});
                }
            });
        promises.push(questionPromise);
    }

    Parse.Promise.when(promises).then(function () {
        response.success();
    }, function (error) {
        response.error(error);
    });
});

/**
 * @BeforeSave Follow
 */
Parse.Cloud.beforeSave("Follow", function (request, response) {
    // trigger fanout
    var follow = request.object;

    if(follow.isNew() || !follow.getACL()) {
        var ACL = new Parse.ACL();
        ACL.setPublicReadAccess(true);
        follow.setACL(ACL);
    }

    response.success();
});

/**
 * @AfterSave Follow
 * Activity Stream
 */
Parse.Cloud.afterSave(Follow, function (request) {
    var follow = request.object,
        promises = [];
    if (!follow.existed()) {
        logger.log("activity-stream", "saving follow");

        promises.push(addActivityToStream(follow.user(), "followed", follow, [follow.following()], follow.following()));

        var flat = GetstreamClient.feed('flat', follow.user().id);
        promises.push(flat.follow('user', follow.following().id, GetstreamUtils.createHandler(logger)));
    }

    return Parse.Promise.when(promises); // Keep alive till done
});

/**
 * @AfterDelete Follow
 * Remove Activity Stream and Following User from
 * Current User.
 */
Parse.Cloud.afterDelete(Follow, function (request) {
    var follow = request.object,
        promises = [];

    // trigger fanout & unfollow
    var feed = GetstreamClient.feed('user', follow.user().id),
        activity = GetstreamUtils.parseToActivity({
            actor: follow.user(),
            object: follow,
            verb: "followed"
        });

    logger.log("activity-stream", "remove follow", activity);
    promises.push(feed.removeActivity({
        foreignId: activity.foreign_id
    }, GetstreamUtils.createHandler(logger)));

    // Remove previously followed user from user's feed
    var flat = GetstreamClient.feed('flat', follow.user().id);
    promises.push(flat.unfollow('user', follow.following().id, GetstreamUtils.createHandler(logger)));

    return Parse.Promise.when(promises);
});

/**
 * @BeforeSave Like
 */
Parse.Cloud.beforeSave("Like", function (request, response) {
    // trigger fanout
    var like = request.object;

    if(like.isNew()) {
        var ACL = new Parse.ACL();
        ACL.setPublicReadAccess(true);
        like.setACL(ACL);
    }

    response.success();
});

/**
 * @AfterSave Like
 */
Parse.Cloud.afterSave("Like", function (request) {
    // trigger fanout
    var like = request.object,
        liker = request.user,
        likeObjectQuery = new Parse.Query(like.get(like.activityType()).className);

    if(like.existed())
        return;

    Parse.Cloud.useMasterKey();
    return likeObjectQuery.get(like.get(like.activityType()).id).then(function (objectToLike) {
        objectToLike.increment('likes');
        var activity = GetstreamUtils.parseToActivity({
            actor: liker,
            object: objectToLike,
            verb: 'liked',
            to: [like.activityActor()]
        });

        var feed = GetstreamClient.feed('user', liker.id);

        return Parse.Promise.when([objectToLike.save(), feed.addActivity(activity, GetstreamUtils.createHandler(logger))]);
    });
});