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
    Parse.Cloud.useMasterKey();
    var initialPromises = [],
        testsGenerated = 0;

    // Config needed to determine memory thresholds
    initialPromises.push(Parse.Config.get());
    // Query activated users
    var queryForUsers = new Parse.Query(Parse.User);
    queryForUsers.equalTo('srActivated', true);
    queryForUsers.lessThanOrEqualTo('srNextDue', new Date());
    queryForUsers.limit(100);

    initialPromises.push(queryForUsers.find());

    // Loop through users with SR activated and SR due time in the past
    return Parse.Promise.when(initialPromises).then(function (config, users) {
        // Spaced Repetition Category for all SR tests
        var spacedRepetitionCategory = new Category();
        spacedRepetitionCategory.id = config.get('srCategoryId');
        // Per user, we create a promise, and resolve for all before
        // setting this task as complete.
        var perUserPromises = [];
        _.each(users, function (user) {

            // SR Intensity Level for User
            var srIntensityLevel = _.where(config.get('srIntensityLevels'), {level: user.get('srIntensityLevel')})[0],
                urRelation = user.uniqueResponses(),
                urQuery = urRelation.query();
            // Find URs below the user's SR intensity threshold
            urQuery.lessThanOrEqualTo('memoryStrength', srIntensityLevel.upperLimit);
            urQuery.ascending('memoryStrength');
            // Max 30 questions per test (intensity level based)
            // But we shuffle the lowest 60 to be unpredictable
            urQuery.limit(60);
            urQuery.include('question');

            // Get current time based on User's timeZone
            var timeZone = user.get('timeZone'),
                now = moment().tz(timeZone);

            // scheduleSlotForSR contains the *slot* and the exact *time* (Moment)
            // at which this test will be sent to the user.
            var scheduleForSR = findNextAvailableSlotForSR(now, config.get('srDailySlots'),
                user.get('srDoNotDisturbTimes'));

            // Don't cycle through this user again
            // until two hours after the scheduled time for this test.
            // Even if a test is not generated (due to lack of URs for e.g.),
            // this will still be saved.
            var srNextDue = _.clone(scheduleForSR.time).add(2, 'hours');
            user.set('srNextDue', srNextDue.toDate());

            // Begin by getting URs and updating their memory strengths
            var perUserPromise =
                UniqueResponse.findWithUpdatedMemoryStrengths(urQuery).then(function (uniqueResponses) {
                    if (!uniqueResponses.length) {
                        return null;
                    }
                    // Generate the SR test
                    var test = new Test();
                    test.set('isGenerated', true);
                    test.set('isSpacedRepetition', true);
                    test.set('isPublic', false);
                    test.setAuthor(user);
                    test.set('category', spacedRepetitionCategory);
                    var daysOfTheWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
                        title = daysOfTheWeek[scheduleForSR.time.day()];
                    title += " " + scheduleForSR.slot.label.camelCaseToNormal() + " test";
                    var humanDate = scheduleForSR.time.format("Do of MMMM, YYYY");
                    test.set('description', "This test was created and sent to you on " + humanDate);
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
                    _.each(_.shuffle(uniqueResponses), function (uniqueResponse, index) {
                        if (index < srIntensityLevel.maxQuestions) {
                            questions.push(uniqueResponse.get('question'));
                            totalDifficulty += uniqueResponse.question().difficulty();
                            _.each(uniqueResponse.get('question').get('tags'), function (tag) {
                                if (!_.contains(testTags, tag))
                                    testTags.push(tag);
                            });
                        }
                    });
                    test.set('questions', questions);
                    test.set('totalQuestions', questions.length);
                    test.set('difficulty', Math.round(totalDifficulty / test.totalQuestions()));
                    test.set('tags', testTags);
                    return test.save();
                }).then(function (test) {
                    if (!test)
                        return;
                    user.set('srLatestTest', test);
                    user.set('srLatestTestDismissed', false);
                    user.srAllTests().add(test);
                    testsGenerated++;

                    // Save user and create a task for the user to be notified
                    // upon schedule.
                    var innerPromises = [];
                    innerPromises.push(user.save());
                    // TODO uncomment the notifyUser taskCreator and actually write code for notifications.
                    //innerPromises.push(taskCreator('SpacedRepetition', 'notifyUserForSR',
                    //    {scheduledTime: scheduleForSR.time.toDate()}, [test]));
                    return Parse.Promise.when(innerPromises);
                });
            perUserPromises.push(perUserPromise);
        });
        // Set next SR cycle time to 5 minutes from now.
        perUserPromises.push(taskCreator('SpacedRepetition', 'srCycle',
            {scheduledTime: moment().add(5, 'minutes').toDate()}, []));
        return Parse.Promise.when(perUserPromises);
    }).then(function () {
        var changes = {
            'taskStatus': 'done',
            'taskMessage': testsGenerated + ' test(s) generated.',
            'taskClaimed': 1
        };
        return task.save(changes, {useMasterKey: true});
    }, function (error) {
        console.error(JSON.stringify(error));
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

function updateTestStatsAfterAttemptTask(task, params, objects) {
    Parse.Cloud.useMasterKey();
    var test = objects[0],
        questionPointers = objects[1],
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