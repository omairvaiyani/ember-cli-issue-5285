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
        promises.push(user.generateSlug());
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
    var user = request.object;

    if (!user.existed()) {
        var userACL = new Parse.ACL(user);
        userACL.setPublicReadAccess(false);
        user.setACL(userACL);
        Parse.Cloud.useMasterKey();
        user.save();
    }
    // Add/Update search index (async)
    user.indexObject();
});

/**
 * @beforeSave Test
 *
 * New test:
 * - Set default parameters + ACL
 * - Generate slug (async)
 *
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
    } else
        test.set('totalQuestions', test.questions().length);

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
    var test = request.object;

    if (!test.existed()) {
        // New test logic
    } else {
        // Existing test logic
    }
    if(test.isPublic()) {
        // Add/Update search index (async)
        test.indexObject();
    } else {
        // Deletes object from index
        // TODO set flag on object that have been index, to avoid deleting non-indexed objs.
        test.deleteIndexObject();
    }
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
        attempt.setDefaults();
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
 *
 */
Parse.Cloud.afterSave(Attempt, function (request) {
    var attempt = request.object,
        promises = [];

    if (!attempt.existed()) {
        // Test stats will be updated within 15 minutes
        var mainPromise = taskCreator('Statistics', 'updateTestStatsAfterAttempt',
            {}, [attempt.test(), attempt.questions()]);

        promises.push(mainPromise);
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