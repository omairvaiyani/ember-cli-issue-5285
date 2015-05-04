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
 * - Number of Tests by Author
 * -- 1 point per 4 Test
 */
Parse.Cloud.job('testQualityScore', function (request, status) {
    Parse.Cloud.useMasterKey();
    var query = new Parse.Query('Test'),
        promises = [];
    query.include('questions');
    query.include('author');
    query.exists('author');
    query.greaterThanOrEqualTo('updatedAt', moment().subtract(1, 'month').toDate());
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

        // Number of Tests by Author (1 point per 4 tests)
        if (test.get('author') && test.get('author').get('privateData')) {
            var numberOfTestsByAuthor = test.get('author').get('numberOfTests');
            if (numberOfTestsByAuthor) {
                score += Math.round((numberOfTestsByAuthor / 4));
            }
        }
        if (score !== previousScore) {
            test.set('quality', score);
            /*
             * Though adding promises to a promise array
             * would speed up the process, instead of
             * synchronously waiting for each test to save
             * before progress.. our request limit is easily
             * reached. Therefore, we're using this bottlenecking
             * method.
             * Empty promise
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
 *
 */
Parse.Cloud.job("transferEducation", function (request, status) {
    Parse.Cloud.useMasterKey();
    /*var query = new Parse.Query("CourseList");
     query.notContainedIn('name', ["Medicine", "Clinical Science"]);
     query.each(function (course) {
     var studyField = new Parse.Object("StudyField");
     studyField.set('name', course.get('name'));
     return studyField.save();
     }).then(function () {
     status.success();
     }, function (error) {
     status.error(JSON.stringify(error));
     });*/
    var query = new Parse.Query("InstitutionList");
    query.notEqualTo("transferred", true);
    query.each(function (institution) {
        var educationalInstitution = new Parse.Object("EducationalInstitution");
        educationalInstitution.set('name', institution.get('fullName'));
        educationalInstitution.set('type', "University");
        var promises = [];
        institution.set('transferred', true);
        promises.push(institution.save());
        promises.push(educationalInstitution.save());
        return Parse.Promise.when(promises);
    }).then(function () {
        status.success();
    }, function (error) {
        status.error(JSON.stringify(error));
    });
});
/**
 * @BackgroundJob - Index Objects for Swiftype
 * Search indexing for Users and Tests.
 * Only indexes/updates objects updated in the last
 * 25 hours (1 day +- any discrepancies for job run time)
 */
Parse.Cloud.job("indexObjectsForSwiftype", function (request, status) {
    var statusObject = {
        totalUsers: 0,
        totalTests: 0,
        totalStudyFields: 0,
        totalEducationalInstitutions: 0,
        totalCount: 0,
    };

    var query = new Parse.Query(Parse.User);
    query.exists('name');
    query.exists('slug');
    query.include('educationCohort.institution');
    query.include('educationCohort.studyField');
    var yesterday = moment().subtract(25, 'hour');
    query.greaterThanOrEqualTo("updatedAt", yesterday.toDate());
    query.limit(1000);
    var documents = [];
    query.find().then(function (results) {
        _.each(results, function (object) {
            var document = getSwiftDocumentForObject("_User", object);
            if (document)
                documents.push(document);
        });
    }).then(function () {
        if (!documents.length)
            return;
        statusObject.totalCount += documents.length;
        statusObject.totalUsers = documents.length;
        return Parse.Cloud.httpRequest({
            method: 'POST',
            url: getSwiftBulkUpdateRecordUrl('users'),
            headers: {
                'Content-Type': 'application/json'
            },
            body: {
                auth_token: "xBAVD6EFQzt23WJFhp1v",
                documents: documents
            }
        });
    }).then(function () {
        query = new Parse.Query('Test');
        query.exists('author');
        query.exists('category');
        query.include('author');
        query.include('category');
        var yesterday = moment().subtract(25, 'hour');
        query.greaterThanOrEqualTo("updatedAt", yesterday.toDate());
        query.limit(1000);
        documents = [];
        return query.find();
    }).then(function (results) {
        _.each(results, function (object) {
            var document = getSwiftDocumentForObject("Test", object);
            if (document)
                documents.push(document);
        });
    }).then(function () {
        if (!documents.length)
            return;
        statusObject.totalCount += documents.length;
        statusObject.totalTests = documents.length;
        return Parse.Cloud.httpRequest({
            method: 'POST',
            url: getSwiftBulkUpdateRecordUrl('tests'),
            headers: {
                'Content-Type': 'application/json'
            },
            body: {
                auth_token: "xBAVD6EFQzt23WJFhp1v",
                documents: documents
            }
        });
    }).then(function () {
        query = new Parse.Query('StudyField');
        query.exists('name');
        var yesterday = moment().subtract(25, 'hour');
        query.greaterThanOrEqualTo("updatedAt", yesterday.toDate());
        documents = [];
        query.limit(1000);
        return query.find();
    }).then(function (results) {
        _.each(results, function (object) {
            var document = getSwiftDocumentForObject("StudyField", object);
            if (document)
                documents.push(document);
        });
    }).then(function () {
        if (!documents.length)
            return;
        statusObject.totalCount += documents.length;
        statusObject.totalStudyFields = documents.length;
        return Parse.Cloud.httpRequest({
            method: 'POST',
            url: getSwiftBulkUpdateRecordUrl('study-fields'),
            headers: {
                'Content-Type': 'application/json'
            },
            body: {
                auth_token: "xBAVD6EFQzt23WJFhp1v",
                documents: documents
            }
        });
    }).then(function () {
        query = new Parse.Query('EducationalInstitution');
        var yesterday = moment().subtract(25, 'hour');
        query.greaterThanOrEqualTo("updatedAt", yesterday.toDate());
        query.ascending('name');
        query.limit(1000);
        documents = [];
        return query.find();
    }).then(function (results) {
        _.each(results, function (object) {
            var document = getSwiftDocumentForObject("EducationalInstitution", object);
            if (document)
                documents.push(document);
        });
    }).then(function () {
        if (!documents.length)
            return;
        statusObject.totalCount += documents.length;
        statusObject.totalEducationalInstitutions = documents.length;
        return Parse.Cloud.httpRequest({
            method: 'POST',
            url: getSwiftBulkUpdateRecordUrl('educational-institutions'),
            headers: {
                'Content-Type': 'application/json'
            },
            body: {
                auth_token: "xBAVD6EFQzt23WJFhp1v",
                documents: documents
            }
        });
    }).then(function () {
        status.success(JSON.stringify(statusObject));
    }, function (error) {
        status.error(JSON.stringify(error));
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
 * @BackgroundJob CancelExpiredSubscriptions
 *
 * Check each active premium or professional
 * user, and confirm that they have not
 * surpassed expiry date. If they have,
 * deactive their booleans and roles.
 *
 * // TODO Change to privateData.isPremium true
 */
Parse.Cloud.job('cancelExpiredSubscriptions', function (request, status) {
    Parse.Cloud.useMasterKey();
    var query = new Parse.Query('UserPrivate');

    query.equalTo('spacedRepetitionActivated', true);
    // query.equalTo('isPremium',true);
    query.lessThan('spacedRepetitionExpiryDate', moment().toDate());
    // query.lessTan('premiumExpiryDate, moment().toDate());
    var usernames = [],
        premium;
    query.each(function (privateData) {
        privateData.set('spacedRepetitionActivated', false);
        privateData.set('spacedRepetitionCancelled', true);
        privateData.set('isPremium', false);
        privateData.set('premiumCancelled', true);
        usernames.push(privateData.get('username'));
        return privateData.save();
    }).then(function () {
        if (!usernames.length)
            return;
        query = new Parse.Query(Parse.Role);
        query.equalTo('name', "Premium");
        return query.find();
    }).then(function (premium) {
        if (!premium)
            return;
        query = new Parse.Query(Parse.User);
        query.containedIn("username", usernames);
        return query.find();
    }).then(function (users) {
        if (!users || !users.length)
            return;
        premium.getUsers().remove(users);
        return premium.save();
    }).then(function () {
        status.success("Success!");
    }, function (error) {
        status.error(JSON.stringify(error));
    });
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
            query.equalTo('isPremium', true);
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
                            if (!timeZone || timeZone == "null" || timeZone === null)
                                timeZone = "Europe/London";
                            var currentTime = new Date();
                            console.log("Current time " + currentTime + " timeZone " + timeZone);
                            console.log("About to call nextDue SRS function for " + user.get('name'));
                            var localTime = new moment(currentTime).tz(timeZone),
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
                            var ACL = new Parse.ACL(user);
                            gsrAttempt.setACL(ACL);

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
                                }
                            }
                            var maxQuestions = user.get('spacedRepetitionMaxQuestions') ?
                                user.get('spacedRepetitionMaxQuestions') : 15;

                            if (gsrAttempt.get('questions').length > maxQuestions) {
                                var limitedQuestions = _.shuffle(gsrAttempt.get('questions')).splice(0, maxQuestions);
                                console.log(user.get('name') + " limited questions length " + limitedQuestions.length);
                                gsrAttempt.set('questions', limitedQuestions);
                            }
                            console.log(user.get('name') + " Attempt question count " + gsrAttempt.get('questions').length);
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

                            if (!result || !result[0] || !result[0].get('email')) // Doesn't want email, or email not found.
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
                                    content: "https://mycqs.com/mcq/" + gsrAttempt.id
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

Parse.Cloud.job('operationSortOutPrivateData', function (request, response) {
    Parse.Cloud.useMasterKey();
    var query = new Parse.Query(Parse.User),
        num = 0;

    query.doesNotExist('privateData');
    query.each(function (user) {
        var pQuery = new Parse.Query('UserPrivate');
        pQuery.equalTo('username', user.get('username'));
        pQuery.exists('email');
        return pQuery.find()
            .then(function (results) {
                if (results[0]) {
                    var privateData = results[0];
                    user.set('privateData', privateData);
                    num++;
                    return user.save();
                }
            });
    }).then(function () {
        response.success("Added privateData to " + num + " users");
    }, function (error) {
        response.error("Managed " + num + " before error " + JSON.stringify(error));
    });
});

Parse.Cloud.job('exportEmailList', function (request, response) {
    Parse.Cloud.useMasterKey();
    var query = new Parse.Query(Parse.User);
    query.include('privateData');
    query.exists('privateData');
    query.exists('name');
    query.notEqualTo('addedToMailingList', true);
    var promises = [];
    query.each(function (user) {
        if (!user || !user.get('privateData') || !user.get('name'))
            return;
        user.set('addedToMailingList', true);
        var mailing = new Parse.Object('MailingList');
        mailing.set('name', user.get('name'));
        mailing.set('firstName', user.get('name').split(' ')[0]);
        mailing.set('email', user.get('privateData').get('email'));
        mailing.set('user', user);
        promises.push(user.save());
        return mailing.save();
    }).then(function () {
        return Parse.Promise.when(promises);
    }).then(function () {
        response.success("Mailing list size " + promises.length);
    }, function (error) {
        response.error(JSON.stringify(error));
    });
});

Parse.Cloud.job("removeRedundantActions", function (request, status) {
    Parse.Cloud.useMasterKey(); // Need this to delete objects.
    var query = new Parse.Query("Action"),
        redundantActions = 0,
        promises = [];
    query.equalTo('type', "testCreated");
    var promise = Parse.Promise.as();
    query.each(function (action) {
        if (!action.get('test')) {
            redundantActions++;
            promise = promise.then(function () {
                return action.destroy();
            });
        } else {
            promise = promise.then(function () {
                var testQuery = new Parse.Query("Test");
                testQuery.equalTo('objectId', action.get('test').id);
                return testQuery.find().then(function (results) {
                    // Return a promise that will be resolved when the delete is finished.
                    if (!results[0] || !results[0].get('privacy') || results[0].get('isObjectDeleted')) {
                        redundantActions++;
                        return action.destroy();
                    }
                });
            });
        }
        return promise;
    }).then(function () {
        console.log("Calling succcess with deleted actions " + redundantActions);
        status.success("Deleted " + redundantActions + " redundant actions.");
    }, function (error) {
        status.error(error.message);
    });
});

/**
 * --------------
 * setIsMobileUser
 * --------------
 * We used to do a cloud function
 * to check if a user is mobile or not,
 * now, let's set it on the user to avoid
 * repeating this query.
 */
Parse.Cloud.job('setIsMobileUser', function (request, status) {
    Parse.Cloud.useMasterKey();
    var query = new Parse.Query(Parse.Installation),
        notDone = 0,
        actual = 0;
    query.exists('user');
    query.include('user.privateData');
    query.count().then(function (result) {
    }).then(function () {
        return query.each(function (install) {
            var user = install.get('user');
            if (user && user.get('privateData') && !user.get('privateData').get('isMobileUser')) {
                actual++;
                user.get('privateData').set('isMobileUser', true);
                return user.get('privateData').save();
            }
        });
    }).then(function () {
        status.success("Saved "+actual+" installs with user.");
    }, function (error) {
        status.error(JSON.stringify(error));
    });
});
