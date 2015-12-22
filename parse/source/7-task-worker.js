/*
 * TASK WORKER
 */
/*function handleComingFromTask(object) {
 object.unset('silenced_afterSave');
 if (object.has('should_silence_afterSave')) {
 object.unset('should_silence_afterSave');
 object.set('silenced_afterSave', true);
 }
 }

 function setComingFromTask(object) {
 object.set('should_silence_afterSave', true);
 }

 function didComeFromTask(object) {
 return object.has('silenced_afterSave');
 }*/

var WorkTask = Parse.Object.extend('WorkTask');
/**
 * @Function Task Creator
 *
 * @param {String} taskType
 * @param {String} taskAction
 * @param {Object} taskParameters
 * @param {Array} taskObjects
 * @returns {Parse.Promise}
 */
function taskCreator(taskType, taskAction, taskParameters, taskObjects) {
    var task = new WorkTask();
    return task.save({
        'taskType': taskType,
        'taskAction': taskAction,
        'taskParameters': taskParameters,
        'taskObjects': taskObjects,
        'taskClaimed': 0
    }, {useMasterKey: true});
}

// Available actions are defined here and link to their function.
var WorkActions = {
    srCycle: srCycleTask,
    notifyUserForSR: notifyUserForSRTask,
    updateTestStatsAfterAttempt: updateTestStatsAfterAttemptTask
};
/**
 * @Task SR Cycle
 * Every 5 minutes, this task loops through
 * SR activated users, finds their URs,
 * generates a test based on their memoryStrength
 * and study intensity and schedules the test to be
 * sent to them at the next available slot.
 *
 * This task is self cycling.
 * @param {String} task
 * @returns {WorkTask}
 */
function srCycleTask(task) {
    logger.log("spaced-repetition", "task started at " + moment().tz("Europe/London").format("h:mm a, Do MMM YYYY"));
    Parse.Cloud.useMasterKey();
    var initialPromises = [],
        testsGenerated = 0;

    // Config needed to determine memory thresholds
    initialPromises.push(Parse.Config.get());
    // Query activated users
    var queryForUsers = new Parse.Query(Parse.User);
    // Don't want to generate more until last test is taken or dismissed
    queryForUsers.equalTo("srLatestTestIsTaken", true);

    var queryForUsersTwo = new Parse.Query(Parse.User);
    // Don't want to generate more until last test is taken or dismissed
    queryForUsersTwo.equalTo("srLatestTestDismissed", true);

    var mainQueryForUsers = Parse.Query.or(queryForUsers, queryForUsersTwo);
    mainQueryForUsers.equalTo('srActivated', true);
    mainQueryForUsers.lessThanOrEqualTo('srNextDue', new Date());
    mainQueryForUsers.include('educationCohort');
    mainQueryForUsers.limit(100);

    initialPromises.push(mainQueryForUsers.find());

    // Loop through users with SR activated and SR due time in the past
    return Parse.Promise.when(initialPromises).then(function (config, users) {
        logger.log("spaced-repetition", "number of users for this task: " + users.length);
        // Spaced Repetition Category for all SR tests
        var spacedRepetitionCategory = new Category();
        spacedRepetitionCategory.id = config.get('srCategoryId');
        // Per user, we create a promise, and resolve for all before
        // setting this task as complete.
        var perUserPromises = [];
        _.each(users, function (user) {
            logger.log("spaced-repetition", "current loop for: " + user.name() + " (" + user.id + ")");
            // SR Intensity Level for User
            var srIntensityLevel = _.where(config.get('srIntensityLevels'), {level: user.get('srIntensityLevel')})[0],
                urRelation = user.uniqueResponses(),
                urQuery = urRelation.query();
            // Find URs below the user's SR intensity threshold
            logger.log("spaced-repetition", "srIntensity upper limit: " + srIntensityLevel.upperLimit,
                srIntensityLevel);

            urQuery.lessThanOrEqualTo('memoryStrength', srIntensityLevel.upperLimit);
            urQuery.ascending('memoryStrength');
            // Max 30 questions per test (intensity level based)
            // But we shuffle the lowest 60 to be unpredictable
            urQuery.limit(1000);
            urQuery.include('question');


            // Get current time based on User's timeZone
            var timeZone = user.get('timeZone'),
                now = moment().tz(timeZone);

            // scheduleSlotForSR contains the *slot* and the exact *time* (Moment)
            // at which this test will be sent to the user.
            var scheduleForSR = findNextAvailableSlotForSR(now, config.get('srDailySlots'),
                user.srDoNotDisturbTimes());

            var srNextDue;
            if(scheduleForSR.time.diff(now, 'm') <= 5) {
                logger.log("spaced-repetition", user.name() + " time for SR yet");
                // It is close enough to the scheduled slot, proceed with loop
                // But set next due a bit later for the next slot (needs recoding)
                srNextDue= _.clone(scheduleForSR.time).add(2, 'hours');
                user.set('srNextDue', srNextDue.toDate());
                // will be saved in the inner promise.
            } else {
                logger.log("spaced-repetition", user.name() + " not schedule for SR yet");
                // Not time for SR, schedule next loop for five mins before next slot
                srNextDue = _.clone(scheduleForSR.time).subtract(5, 'min');
                user.set('srNextDue', srNextDue.toDate());
                perUserPromises.push(user.save());
                return; // End of loop for user
            }

            // Begin by getting URs and updating their memory strengths
            var perUserPromise =
                UniqueResponse.findWithUpdatedMemoryStrengths(urQuery).then(function (uniqueResponses) {
                    if (!uniqueResponses.length) {
                        return null;
                    }
                    logger.log("spaced-repetition", "number of URs found: " + uniqueResponses.length, user.name());
                    // Generate the SR test
                    var test = new Test();
                    test.set('isGenerated', true);
                    test.set('isSpacedRepetition', true);
                    test.set('isPublic', false);
                    test.setAuthor(user);
                    test.set('category', spacedRepetitionCategory);
                    var daysOfTheWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
                        title = daysOfTheWeek[scheduleForSR.time.day()];
                    title += " " + scheduleForSR.slot.label.camelCaseToNormal() + " Quiz";
                    var humanDate = scheduleForSR.time.format("Do of MMMM, YYYY");
                    test.set('description', "This quiz was generated and sent to you on " + humanDate);
                    test.set('title', title);
                    test.set('slug', user.get('slug') +
                        "-" + scheduleForSR.time.daysInMonth() + "-" + scheduleForSR.time.month() + "-" +
                        scheduleForSR.time.year() + "-" + scheduleForSR.slot.label);

                    var questions = [],
                        testTags = [],
                        totalDifficulty = 0;

                    // Though we want mostly questions with the user's lowest memoryStrengths,
                    // we don't want to be completely linear and predictable.
                    // By shuffling the lowest ~60, and then taking the first [maxQuestions],
                    // we have a good mix of UR memoryStrengths.
                    var shuffledURs = _.shuffle(uniqueResponses);

                    // Get Module tags (either from user or their education cohort)
                    var moduleTags = []; // empty array to avoid breaking first loop
                    if (user.moduleTags())
                        moduleTags = user.moduleTags();
                    else if (user.educationCohort() && user.educationCohort().moduleTags())
                        moduleTags = user.educationCohort().moduleTags();

                    // First loop, only add questions that match moduleTags
                    _.each(shuffledURs, function (uniqueResponse) {
                        if (questions.length < srIntensityLevel.maxQuestions) {

                            var question = uniqueResponse.question();

                            if (_.contains(moduleTags, question.tags())) {
                                questions.push(uniqueResponse.get('question'));
                                totalDifficulty += uniqueResponse.question().difficulty();

                                _.each(question.get('tags'), function (tag) {
                                    if (!_.contains(testTags, tag))
                                        testTags.push(tag);
                                });
                            }
                        }
                    });

                    // Second loop, add other URs if space
                    _.each(shuffledURs, function (uniqueResponse) {
                        if (questions.length < srIntensityLevel.maxQuestions) {

                            var question = uniqueResponse.question();
                            questions.push(question);

                            totalDifficulty += uniqueResponse.question().difficulty();

                            _.each(question.tags(), function (tag) {
                                if (!_.contains(testTags, tag))
                                    testTags.push(tag);
                            });
                        }
                    });

                    test.set('questions', questions);
                    test.set('totalQuestions', questions.length);
                    test.set('difficulty', Math.round(totalDifficulty / test.totalQuestions()));
                    logger.log("spaced-repetition", "number of questions: " + questions.length);
                    test.set('tags', testTags);
                    return test.save();
                }).then(function (test) {
                    if (!test)
                        return;
                    user.set('srLatestTest', test);
                    user.set('srLatestTestDismissed', false);
                    user.set('srLatestTestIsTaken', false);
                    logger.log("spaced-repetition", "test successfully generated: " + test.id);
                    user.srAllTests().add(test);
                    testsGenerated++;

                    // Save user and create a task for the user to be notified
                    // upon schedule.
                    var innerPromises = [];
                    innerPromises.push(user.save());

                    logger.log("spaced-repetition", user.name() + " wants an email? " + user.srNotifyByEmail());
                    if (user.srNotifyByEmail()) {
                        innerPromises.push(sendEmail("spaced-repetition",
                            user.email(), user, [
                                {"name": "TEST_TITLE", content: test.title()},
                                {name: "TEST_LINK", content: APP.baseUrl + APP.testInfo + test.slug()},
                                {name: "NUM_QUESTIONS", content: test.totalQuestions()},
                                {
                                    name: "TAGS",
                                    content: test.tags().length ? test.tags().humanize() : "a range of areas"
                                }
                            ]));
                    }

                    return Parse.Promise.when(innerPromises);
                });
            perUserPromises.push(perUserPromise);
        });
        return Parse.Promise.when(perUserPromises);
    }).then(function () {
        // Set next SR cycle time to 5 minutes from now.
        var changes = {
            taskStatus: 'done',
            taskMessage: testsGenerated + ' test(s) generated.',
            taskClaimed: 0, // repetitive task, do not destroy
            scheduledTime: moment().add(5, 'minutes').toDate()
        };
        return task.save(changes, {useMasterKey: true});
    }, function (error) {
        console.error(JSON.stringify(error));
        logger.log("Spaced Repetition Cycle", "error", error);
    });
}

function notifyUserForSRTask(task) {
    var changes = {
        'taskStatus': 'done',
        'taskMessage': '',
        'taskClaimed': 1
    };
    return task.save(changes, {useMasterKey: true});
}

/**
 * @Task Update Test Stats After Attempt
 *
 * Set on Attempt.afterSave
 *
 * @param task
 * @param params
 * @param objects
 * @returns {*}
 */
function updateTestStatsAfterAttemptTask(task, params, objects) {
    Parse.Cloud.useMasterKey();
    var test = objects[0],
        questionPointers = objects[1],
        attempt = objects[2],
        user = objects[3],
        questionQuery = new Parse.Query(Question);

    questionQuery.containedIn("objectId", _.map(questionPointers, function (questionPointer) {
        return questionPointer.id;
    }));

    return questionQuery.find().then(function (questions) {

        test.increment('numberOfAttempts');

        // The test.averageScore is not the average attempt score on the test,
        // rather, it's the tally of average correctness in its individual
        // questions - this allows flexibility should the questions be moved
        // between tests.
        var questionPercentOfCorrectnessTally = 0,
            questionPercentOfUniqueCorrectnessTally = 0,
            numberOfUniqueResponsesTally = 0,
            totalDifficulty = 0;

        _.each(questions, function (question) {
            questionPercentOfCorrectnessTally += question.percentOfCorrectResponses();
            questionPercentOfUniqueCorrectnessTally += question.percentOfCorrectUniqueResponses();
            numberOfUniqueResponsesTally += question.numberOfUniqueResponses();
            totalDifficulty += question.difficulty();
        });

        test.set('averageScore', Math.round(questionPercentOfCorrectnessTally / questions.length));

        // Similarly, test.averageUniqueScore is based upon that of its questions
        // NOTE, it does not matter if this current attempt is unique or not.
        // We are simply updating the test attributes with the real info from the questions.
        test.set('averageUniqueScore', Math.round(questionPercentOfUniqueCorrectnessTally / questions.length));

        // Following from what is mentioned above, we can take the average of the
        // questions.@each.numberOfUniqueResponses to set the tests.numberOfUniqueResponses.
        test.set('numberOfUniqueAttempts', Math.round(numberOfUniqueResponsesTally / questions.length));

        // Average difficulty of questions. Default difficulty for each question is 50.
        test.set('difficulty', Math.round(totalDifficulty / questions.length));

        // MasterKey is needed due to the Test's ACLs, even request.user === author.
        return test.save(null, {useMasterKey: true});
    }).then(function () {
        // Prepare to update stats for test's author and user
        var author = test.get('author');

        var attemptsQuery = new Parse.Query(Attempt);
        attemptsQuery.equalTo('user', user);
        attemptsQuery.equalTo('test', test);
        attemptsQuery.ascending('createdAt');
        return Parse.Promise.when(author.fetch(), attemptsQuery.find());
    }).then(function (author, previousAttempts) {
        // Update Author
        if (author.id !== user.id)
            author.increment('numberOfAttemptsByCommunity');

        // Update Author and User for Unique Attempt
        // Normal attempt count updated more immediately in
        // the first cloud function for attempt generation
        var isUnique = previousAttempts[0] && previousAttempts[0].id === attempt.id;
        if (isUnique) {
            if (author.id !== user.id)
                author.increment('numberOfUniqueAttemptsByCommunity');
            user.increment('numberOfUniqueAttempts');
        }

        return Parse.Promise.when(author.save(null, {useMasterKey: true}), user.save(null, {useMasterKey: true}));
    }).then(function () {
        var changes = {
            'taskStatus': 'done',
            'taskMessage': '',
            'taskClaimed': 1
        };
        return task.save(changes, {useMasterKey: true});
    }, function (error) {
        console.error(JSON.stringify(error));
    });
}

/**
 * @Function Is Task Scheduled for Now
 * Some tasks are only meant to run at
 * specific times or intervals. Others
 * must be run whenever present.
 * @param {WorkTask} task
 * @returns {boolean}
 */
var isTaskScheduledForNow = function (task) {
    if (!task.get('taskParameters') || !task.get('taskParameters')['scheduledTime'])
        return true;
    var now = moment(),
        scheduledTime = moment(task.get('taskParameters')['scheduledTime']);

    return now.isAfter(scheduledTime);
};

// This background job is scheduled, or run ad-hoc, and processes outstanding tasks.
Parse.Cloud.job('workQueue', function (request, status) {
    Parse.Cloud.useMasterKey();
    var query = new Parse.Query(WorkTask);
    query.equalTo('taskClaimed', 0);
    query.include('taskObjects');
    var processed = 0,
        removed = 0;
    query.each(function (task) {
        // This block will return a promise which is manually resolved to prevent errors from bubbling up.
        var promise = new Parse.Promise();
        processed++;
        var params = task.get('taskParameters'),
            objects = task.get('taskObjects'),
        // The taskClaimed field is automatically incremented to ensure that it is processed only once.
            action = task.get('taskAction');
        // invalid actions not defined by WorkActions are discarded and will not be processed again.
        if (task.get('taskClaimed') == 0 && WorkActions[action] && isTaskScheduledForNow(task)) {
            WorkActions[action](task, params, objects).then(function () {
                promise.resolve();
            }, function () {
                promise.resolve();
            });
        } else {
            promise.resolve();
        }
        return promise;
    }).then(function () {
        var query = new Parse.Query(WorkTask);
        query.equalTo('taskClaimed', 1);
        return query.each(function (task) {
            removed++;
            return task.destroy();
        });
    }).then(function () {
        status.success('Processed: ' + processed + ', Removed ' + removed);
    }, function (err) {
        console.log(err);
        status.error('Something failed!  Check the cloud log.');
    });
});