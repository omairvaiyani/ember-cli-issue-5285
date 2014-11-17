/**
 * @BackgroundJob Test Quality Score
 *
 * For each test, use our algorithm
 * for determining good quality tests
 * - Max score 100
 * -- Low quality cut off, 20
 * - Judge by number of questions (MAX 25)
 * -- 10-25 optimal
 * - % of explanations (MAX 25)
 * -- 100% is best
 * - Number of attempts (MAX 15)
 * -- Variable
 * - Percentage of unique attempts (MAX 20)
 * -- Lower the better (more repeats), below 50% for now
 * - Unique average scores (MAX 15)
 * -- Optimal is 55-85%
 */
Parse.Cloud.job('testQualityScore', function (request, status) {
    Parse.Cloud.useMasterKey();
    var query = new Parse.Query('Test'),
        promises = [];
    query.include('questions');
    query.each(function (test) {
        var previousScore = test.get('quality'),
            score = 0;

        var numberOfQuestions = test.get('questions').length;
        // Number of questions 0-4 = 0
        // Number of questions 5-9 = +5
        if (numberOfQuestions > 4 && numberOfQuestions < 10)
            score += 5;
        // Number of questions 10-25 = +25
        else if (numberOfQuestions > 9 && numberOfQuestions < 26)
            score += 25;
        // Number of questions 25+ = +15
        else if (numberOfQuestions > 25)
            score += 15;

        var numberOfExplanations = 0,
            percentageOfExplanations = 0;

        for (var i = 0; i < test.get('questions').length; i++) {
            var question = test.get('questions')[i];
            if (!question)
                continue;
            if (question.get('explanation') && question.get('explanation').length)
                numberOfExplanations++;
        }
        // Percentage of explanations 0% or 0 questions = 0
        if (numberOfExplanations && test.get('questions').length) {
            percentageOfExplanations = Math.floor((numberOfExplanations / test.get('questions').length) * 100);
            // Percentage of explanations > 0 and < 25 questions = +5
            if (percentageOfExplanations > 0 && percentageOfExplanations < 25)
                score += 5;
            // Percentage of explanations > 24 and < 50 questions = +10
            else if (percentageOfExplanations > 24 && percentageOfExplanations < 50)
                score += 10;
            // Percentage of explanations > 49 and < 75 = +15
            else if (percentageOfExplanations > 49 && percentageOfExplanations < 75)
                score += 15;
            // Percentage of explanations > 74 and < 100 questions = +20
            else if (percentageOfExplanations > 74 && percentageOfExplanations < 100)
                score += 20;
            // Percentage of explanations 100% = +25
            else if (percentageOfExplanations === 100)
                score += 25;
        }

        var numberOfAttempts = test.get('numberOfAttempts');
        // Number of attempts 0 = 0
        // Number of attempts > 0 and < 5 = +5
        if (numberOfAttempts > 0 && numberOfAttempts < 5)
            score += 5;
        // Number of attempts > 5 and < 15 = +10
        else if (numberOfAttempts > 4 && numberOfAttempts < 15)
            score += 10;
        // Number of attempts > 14 = +15
        else if (numberOfAttempts > 14)
            score += 15;

        var uniqueNumberOfAttempts = test.get('uniqueNumberOfAttempts'),
            percentageOfUniqueAttempts;


        if (uniqueNumberOfAttempts && numberOfAttempts) {
            percentageOfUniqueAttempts = Math.floor((uniqueNumberOfAttempts / numberOfAttempts) * 100);
            // Percentage of unique attempts 0 = +25
            if (percentageOfUniqueAttempts < 10)
                score += 25;
            // Percentage of unique attempts > 9 and < 25 = 20
            else if (percentageOfUniqueAttempts > 9 && percentageOfUniqueAttempts < 25)
                score += 20;
            // Percentage of unique attempts > 24 and < 50 = 15
            else if (percentageOfUniqueAttempts > 24 && percentageOfUniqueAttempts < 50)
                score += 15;
            // Percentage of unique attempts > 49 and < 75 = 10
            else if (percentageOfUniqueAttempts > 49 && percentageOfUniqueAttempts < 75)
                score += 10;
            // Percentage of unique attempts > 74 = 0
        }

        var uniqueAverageScore = test.get('uniqueAverageScore');

        // Unique average score 0 = 0
        // Unique average score > 0 and < 40 = 5
        if (uniqueAverageScore > 0 && uniqueAverageScore < 40)
            score += 5;
        // Unique average score > 39 and < 55 = 10
        else if (uniqueAverageScore > 39 && uniqueAverageScore < 55)
            score += 10;
        // Unique average score > 54 and < 85 = 20
        else if (uniqueAverageScore > 54 && uniqueAverageScore < 85)
            score += 15;
        // Unique average score > 84 = 15
        else if (uniqueAverageScore > 84)
            score += 10;

        if (score !== previousScore) {
            test.set('quality', score);
            /*
             * Though adding promises to a promise array
             * would speed up the process, instead of
             * synchronously waiting for each test to save
             * before progress.. our request limit is easily
             * reached. Therefore, we're using this bottlenecking
             * method.
             * Empty p
             */
            promises.push({});
            return test.save();
            // promises.push(test.save());
        }
    }, function (error) {
        console.error("Error looping through test in Test Quality Score job " + JSON.stringify(error));
        // }).then(function () {
        //   return Parse.Promise.when(promises);
    }).then(function () {
        status.success("Successfully updated " + promises.length + " test scores!");
    }, function (error) {
        status.error("Only updated " + promises.length + " tests before error. " + JSON.stringify(error));
    })
});

/**
 * @BackgroundJob - Index Objects for Class
 * Search indexing
 * Add objects to Swiftype
 * @param className
 */
Parse.Cloud.job("indexObjectsForClass", function (request, status) {
    Parse.Cloud.useMasterKey();

    var className = request.params.className,
        query = new Parse.Query(className),
        swiftApiUrl;

    switch (className) {
        case "_User":
            query = new Parse.Query(Parse.User);
            query.include('course');
            query.include('institution');
            swiftApiUrl = "http://api.swiftype.com/api/v1/engines/mycqs/document_types/users/documents/create_or_update.json";
            break;
        case "Test":
            query.include('author');
            query.include('category');
            swiftApiUrl = "http://api.swiftype.com/api/v1/engines/mycqs/document_types/tests/documents/create_or_update.json";
            break;
    }

    var document;
    query.each(function (object) {
        document = getSwiftDocumentForObject(className, object);
        if (!document)
            return;

        return Parse.Cloud.httpRequest({
            method: 'POST',
            url: swiftApiUrl,
            headers: {
                'Content-Type': 'application/json'
            },
            body: {
                auth_token: "xBAVD6EFQzt23WJFhp1v",
                document: document
            }
        }).then(function (success) {
                console.log("Successful call to swiftype, " + JSON.stringify(success.data));
            },
            function (error) {
                console.log("Document error: " + JSON.stringify(document));
                console.log("Failure to call to swiftype, " + error.text);
            });

    }).then(
        function () {
            status.success();
        }, function () {
            status.error();
        });

});

/**
 * @BackgroundJob - Update the Count Class
 * Saves us counting through hundreds of thousands of
 * rows per client visit.
 */
Parse.Cloud.job("updateCountClass", function (request, status) {
    Parse.Cloud.useMasterKey();
    /*
     * _User
     */
    var query = new Parse.Query("Count"),
        users,
        tests,
        questions,
        attempts,
        promises = [],
        ACL = new Parse.ACL();

    ACL.setPublicReadAccess(true);

    query.find()
        .then(function (results) {
            for (var i = 0; i < results.length; i++) {
                switch (results[i].get('type')) {
                    case "users":
                        users = results[i];
                        break;
                    case "tests":
                        tests = results[i];
                        break;
                    case "questions":
                        questions = results[i];
                        break;
                    case "attempts":
                        attempts = results[i];
                        break;
                }
            }
            query = new Parse.Query(Parse.User);
            return query.count();
        })
        .then(function (count) {
            users.set('total', count);
            users.setACL(ACL);
            promises.push(users.save());

            query = new Parse.Query("Test");
            return query.count();
        })
        .then(function (count) {
            tests.set('total', count);
            tests.setACL(ACL);
            promises.push(tests.save());

            query = new Parse.Query("Question");
            return query.count();
        })
        .then(function (count) {
            questions.set('total', count);
            questions.setACL(ACL);
            promises.push(questions.save());

            query = new Parse.Query("Attempt");
            return query.count();
        })
        .then(function (count) {
            attempts.set('total', count);
            attempts.setACL(ACL);
            promises.push(attempts.save());

            return Parse.Promise.when(promises);
        })
        .then(function () {
            status.success();
        });
});

/**
 * @BackgroundJob - Calculate total tests in Each Category
 * Loops through child categories
 * Updates total test count on them
 * and their parent categories.
 */
Parse.Cloud.job("calculateTotalTestsInEachCategory", function (request, status) {
    Parse.Cloud.useMasterKey();
    /*
     * Get all bottom level
     * categories:
     * - No children
     * - Has tests directly associated
     * with it)
     */
    var childCategories = [],
        testCounts = [],
        parentCategories = [],
        saveCategoriesPromises = [];

    var lookup = function (array, object) {
        for (var i = 0; i < array.length; i++) {
            if (array[i].id === object.id)
                return array[i];
        }
        return false;
    };

    var query = new Parse.Query('Category');
    query.equalTo('hasChildren', false);
    query.include('parent');
    query.each(function (category) {
        /*
         * Count the number of tests
         * belonging to this category
         */
        var testQuery = new Parse.Query('Test');
        testQuery.equalTo('category', category);
        testQuery.notEqualTo('isObjectDeleted', true);
        testQuery.equalTo('privacy', 1);
        childCategories.push(category);
        testCounts.push(testQuery.count());
        if (category.get('parent') && !lookup(parentCategories, category.get('parent'))) {
            category.get('parent').set('totalTests', 0);
            parentCategories.push(category.get('parent'));
        }
    }).then(function () {
        return Parse.Promise.when(testCounts);
    }).then(function () {
        for (var i = 0; i < childCategories.length; i++) {
            var childCategory = childCategories[i],
                totalTests = testCounts[i]._result[0];

            childCategory.set('totalTests', totalTests);
            if (childCategory.get('parent')) {
                var parentCategory = lookup(parentCategories, childCategory.get('parent'));
                parentCategory.increment('totalTests', totalTests);
            }
            saveCategoriesPromises.push(childCategory.save());
        }

        for (var i = 0; i < parentCategories.length; i++) {
            saveCategoriesPromises.push(parentCategories[i].save());
        }
        return Parse.Promise.when(saveCategoriesPromises);
    }).then(function () {
        status.success();
    })
});

/**
 * @BackgroundJob SpacedRepetitionRunLoop
 *
 * Spaced Repetition System (SRS)
 *
 * This job achieves a number of SRS tasks for
 * the subscribed users:
 * - Checks if they have any Unique Responses (URs)
 * - If so, checks if they have a Generated SR Test (GSR Test)
 * - If no, create one; if yes, clears its questions
 * - Check when the next due time is for their set intensity
 * - Update nextDue date if needed
 *
 * - If current time is equal to due time, carry on
 * - Per UR, check if the time since question was answered equals time to repeat*
 * - If true, add question to the GSR Test
 * - Once GSR Test is ready, shuffle and strip down to 15 questions
 * - Schedule push.
 *
 * repeat*: SRS repeat timings update as the user consecutively answers
 * the question correctly: moving from Box 1 to Box 2: as per Intensity level.
 *
 * SRS Intensity and Box are configuration dependent.
 */
Parse.Cloud.job('spacedRepetitionRunLoop', function (request, status) {
    Parse.Cloud.useMasterKey();
    var query,
        srIntensityLevels,
        promises = [];

    Parse.Config.get()
        .then(function (config) {
            srIntensityLevels = config.get("spacedRepetitionIntensityLevels");
            query = new Parse.Query('UserPrivate');
            query.equalTo('spacedRepetitionActivated', true);
            return query.find();
        })
        .then(function (results) {
            var usernames = [];
            for (var i = 0; i < results.length; i++) {
                usernames.push(results[i].get('username'));
            }
            query = new Parse.Query(Parse.User);
            query.containedIn('username', usernames);
            if (request.params.userId)
                query.equalTo('objectId', request.params.userId);
            query.include('privateData');
            return query.each(
                function (user) {
                    var privateData = user.get('privateData'),
                        srIntensityNumber = user.get('spacedRepetitionIntensity'),
                        srIntensityLevel = srIntensityLevels[srIntensityNumber - 1],
                        installation,
                        timeZone = user.get('timeZone'),
                        gsrTest,
                        isGSRTestNew = false,
                        gsrAttempt = new Parse.Object('Attempt');

                    /*
                     * TimeZone is set:
                     * - Parse.Installation for app users
                     * - _User for web users
                     */
                    query = new Parse.Query(Parse.Installation);
                    query.equalTo('user', user);
                    return query.find()
                        .then(function (installations) {
                            if (installations[0]) {
                                installation = installations[0];
                                timeZone = installation.get('timeZone');
                            }
                            var currentTime = new Date(),
                                localTime = new moment(currentTime).tz(timeZone),
                                localTimeHours = localTime.format('HH'),
                                nextDue = getNextDueTimeForSRSTest(srIntensityLevel, timeZone);

                            if (user.get('spacedRepetitionNextDue') !== nextDue) {
                                user.set('spacedRepetitionNextDue', nextDue._d);
                                promises.push(user.save());
                            }
                            /*
                             * See if the user's intensity level allows for a
                             * test to be sent now: based on their timezone.
                             */
                            if (srIntensityLevel.times.indexOf(localTimeHours + "00") === -1) {
                                console.log(user.get("name") + " is not expecting a push/email yet.");
                                return PromiseHelper.ABORT_CHAIN;
                            } else {
                                console.log("Preparing a SRS test for " + user.get("name"));
                            }

                            query = new Parse.Query('Test');
                            query.equalTo('author', user);
                            query.equalTo('isSpacedRepetition', true);
                            return query.find()
                        })
                        .then(function (results) {
                            if (results === PromiseHelper.ABORT_CHAIN)
                                return PromiseHelper.ABORT_CHAIN;

                            if (results[0]) {
                                gsrTest = results[0];
                                //gsrTest.set('questions', []); removed this, as questions will be a superset
                                // of all SRS questions
                                return gsrTest;
                            } else {
                                isGSRTestNew = true;
                                var Test = Parse.Object.extend('Test');
                                gsrTest = new Test();
                                gsrTest.set('isGenerated', true);
                                gsrTest.set('isSpacedRepetition', true);
                                gsrTest.set('author', user);
                                gsrTest.set('title', "Spaced Repetition Test");
                                gsrTest.set('privacy', 0);
                                gsrTest.set('questions', []);
                                var Category = Parse.Object.extend('Category'),
                                    srCategory = new Category();
                                srCategory.id = "jWx56PKQzU"; // Spaced Repetition is a Category
                                gsrTest.set('category', srCategory);
                                var ACL = new Parse.ACL();
                                ACL.setReadAccess(user.id, true);
                                gsrTest.setACL(ACL);
                                return gsrTest.save();
                            }
                        }, function (error) {
                            console.error("Error finding if SRS user has a GSR Test");
                        })
                        .then(function (gsrTest) {
                            if (gsrTest === PromiseHelper.ABORT_CHAIN)
                                return PromiseHelper.ABORT_CHAIN;

                            query = new Parse.Query('UniqueResponse');
                            query.equalTo('user', user);
                            console.log(user.get('name') + " is srs new> " + isGSRTestNew);
                            if (isGSRTestNew) {
                                /* We'll need to find all their recent
                                 * URs to prefill the GSRTest.questions
                                 */
                                query.descending('updatedAt');
                                query.limit(250);
                            } else {
                                /*
                                 * We already have a superset of GSRTest.questions
                                 * This query is therefore to check the current
                                 * box number for these questions.
                                 */
                                query.containedIn('question', gsrTest.get('questions'));
                            }
                            return query.find();
                        }, function (error) {
                            console.error("Error saving new GSR Test for user " + user.id + " error: " + JSON.stringify(error));
                        })
                        .then(function (uniqueResponses) {
                            if (uniqueResponses === PromiseHelper.ABORT_CHAIN)
                                return PromiseHelper.ABORT_CHAIN;

                            if (!uniqueResponses || !uniqueResponses.length) {
                                console.error("No URs or GSRTest.questions* for " + user.get('name'));
                                return PromiseHelper.ABORT_CHAIN;
                            }

                            /*
                             * We are pushing an Attempt object
                             * to the client. The attempt will
                             * have the due questions.
                             */
                            gsrAttempt.set('test', gsrTest);
                            gsrAttempt.set('questions', []);
                            gsrAttempt.set('user', user);
                            gsrAttempt.set('responses', []); // Only for convenience, not used here.
                            gsrAttempt.set('isSRSAttempt', true);

                            console.log(user.get("name") + " UR found " + uniqueResponses.length);

                            for (var i = 0; i < uniqueResponses.length; i++) {
                                var uniqueResponse = uniqueResponses[i];
                                // Prefill a new GSRTest.questions with all URs
                                if (isGSRTestNew)
                                    gsrTest.get('questions').push(uniqueResponse.get('question'));

                                var timeSinceTaken = Math.abs(new Date() - uniqueResponse.updatedAt) / 36e5,
                                    srBox = uniqueResponse.get('spacedRepetitionBox'),
                                    timeToRepeat = srIntensityLevel.boxes[srBox - 1],
                                    isTimeToRepeat = timeSinceTaken >= timeToRepeat;

                                if (isTimeToRepeat) {
                                    gsrAttempt.get('questions').push(uniqueResponse.get('question'));
                                } else {
                                    // TODO REMOVE THIS WHEN LIVE
                                    gsrAttempt.get('questions').push(uniqueResponse.get('question'));
                                }
                            }
                            console.log(user.get('name') + " Attempt question count " + gsrAttempt.get('questions').length);
                            var maxQuestions = user.get('spacedRepetitionMaxQuestions') ?
                                user.get('spacedRepetitionMaxQuestions') : 15;

                            if (gsrAttempt.get('questions').length > maxQuestions) {
                                var limitedQuestions = _.shuffle(gsrAttempt.get('questions')).splice(0, maxQuestions);
                                console.log(user.get('name') + " limited questions length " + limitedQuestions.length);
                                gsrAttempt.set('questions', limitedQuestions);
                            }
                            /*
                             * If GSRTest is new, we will have added
                             * new questions (URs) to it in the forLoop
                             * above, therefore we need to save it.
                             * However, it is not essential for the next
                             * chain, hence it is done asynchronously.
                             */
                            if (isGSRTestNew)
                                promises.push(gsrTest.save());


                            console.log(user.get('name') + " saving SRS attempt");
                            return gsrAttempt.save();
                        },
                        function (error) {
                            console.error("Error getting uniqueResponse for user " + user.id + " error: "
                            + JSON.stringify(error));
                        })
                        .then(function (gsrAttempt) {
                            if (gsrAttempt === PromiseHelper.ABORT_CHAIN)
                                return PromiseHelper.ABORT_CHAIN;

                            user.set('latestSRSAttempt', gsrAttempt);
                            promises.push(user.save());

                            if (!gsrAttempt.get('questions').length) { // Empty attempt
                                console.log("There are no questions for this SRS attempt for " + user.get("name"));
                                return;
                            }
                            // Create a Message object
                            var message = new Parse.Object("Message"),
                                messageText = "";
                            if (gsrAttempt.get('questions').length === 1)
                                messageText += "You just have 1 question to do for now!";
                            else
                                messageText += "Here are " + gsrAttempt.get('questions').length + " questions for you to do!";
                            message.set('to', user);
                            message.set('type', 'SRS');
                            message.set('message', messageText);
                            message.set('isAutomated', true);
                            message.set('attempt', gsrAttempt);
                            message.setACL(new Parse.ACL(user));
                            promises.push(message.save());
                            if (user.get('spacedRepetitionNotificationByPush')) {
                                console.log("Sending GSR Attempt by push to " + user.get('name'));
                                promises.push(Parse.Cloud.run('sendPushToUser',
                                    {
                                        message: messageText,
                                        recipientUserId: user.id,
                                        actionName: 'take-attempt',
                                        sound: 'srs',
                                        actionParams: [{name: "attempt", "content": gsrAttempt.id},
                                            {"name": "type", "content": "spaced-repetition"}]
                                    }));
                            }
                            // TODO Remove this once we're happy to send out emails again!
                            return;

                            if (user.get('spacedRepetitionNotificationByEmail')) {
                                var query = new Parse.Query('UserPrivate');
                                query.equalTo('username', user.getUsername());
                                return query.find();
                            } else {
                                return;
                            }
                        }, function (error) {
                            console.error("Error saving GSR Test after adding questions to it, error "
                            + JSON.stringify(error));
                        })
                        .then(function (result) {
                            if (result === PromiseHelper.ABORT_CHAIN)
                                return PromiseHelper.ABORT_CHAIN;

                            if (!result || !result[0]) // Doesn't want email, or email not found.
                                return;

                            var email = result[0].get('email');
                            console.log(user.get('name') + " will be emailed with their GSR attempt at " + email);
                            return promises.push(sendEmail('spaced-repetition-system-test-ready',
                                user, email,
                                [{
                                    name: "NUMQUESTIONS",
                                    content: gsrAttempt.get('questions').length
                                }, {
                                    name: "TESTLINK",
                                    content: "http://mycqs.com/mcq/srs/" + gsrAttempt.id
                                }]));
                        });
                },
                function (error) {
                    if (error)
                        console.error("Error looping through SRS subscribed user " + JSON.stringify(error));
                })
                .then(function () {
                    // Wait for pushes and emails to be sent
                    return Parse.Promise.when(promises);
                })
                .then(function () {
                    status.success("Successful");
                },
                function (error) {
                    status.error(JSON.stringify(error));
                    console.error("Error getting Config for SRS, error: " + JSON.stringify(error));
                });
        });
});

//@Deprecated
/**
 * @BackgroundJob operationSortOutACLs
 * Our ACLs were messed up during migration
 * due to Request.User being null with
 * PHP mismanaging currentUser sessionTokens.
 *
 * Therefore, many objects were set with {}
 * ACLs, i.e., completely hidden without
 * masterkey. Sort. It. Out.
 *
 */
/*
 Parse.Cloud.job('operationSortOutACLs', function (request, response) {
 Parse.Cloud.useMasterKey();
 var query = new Parse.Query(Parse.User),
 promises = [],
 numQuestionsWithBadACL = 0,
 user;

 query.get(request.params.userId).then(function (result) {
 user = result;
 if (user)
 console.log("User found: " + user.get('name'));
 query = new Parse.Query("Test");
 query.equalTo('author', user);
 query.include('questions');
 return query.find();
 }).then(function (tests) {
 console.log(user.get('name') + " has " + tests.length + " tests.");
 for (var i = 0; i < tests.length; i++) {
 var test = tests[i],
 questions = test.get('questions');
 console.log("Test " + test.get('title') + " has " + questions.length + " questions.");
 if (!questions)
 continue;
 for (var j = 0; j < questions.length; j++) {
 var question = questions[j];
 if (!question) {
 console.log("question does not exist");
 } else {
 console.log("Checking ACL " + JSON.stringify(question.getACL()));
 var currentACL = question.getACL();
 if (!currentACL ||
 JSON.stringify(currentACL) === '{}' || JSON.stringify(currentACL) === '{"*":{"read":true}}') {
 console.log("BAD ACL match");
 var newACL = new Parse.ACL(user);
 newACL.setPublicReadAccess(true);
 question.setACL(newACL);
 question.set("ACLFixed", true);
 promises.push(question.save());
 numQuestionsWithBadACL++;
 }
 }
 }
 }
 },
 function (error) {
 console.error("Error getting test");
 })
 .then(function () {
 console.log("Waiting for promises " + promises.length);
 return Parse.Promise.when(promises);
 })
 .then(function () {
 response.success(numQuestionsWithBadACL + " questions with bad ACL flagged!");
 }, function (error) {
 response.error(JSON.stringify(error));
 });
 }); */
