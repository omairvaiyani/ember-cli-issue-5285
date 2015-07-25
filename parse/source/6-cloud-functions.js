/*
 * CLOUD FUNCTIONS
 */

/**
 * @CloudFunction Initialise App for User
 *
 * This minimises time spent for the app's initial load
 * by sending all required objects on load. Useful for both
 * guests and currentUsers.
 * - Send Parse.Config
 * - Send all categories
 * If currentUser
 * - EducationCohort
 * - Created tests
 * - Saved tests
 * - Unique responses
 */
Parse.Cloud.define("initialiseWebsiteForUser", function (request, response) {
    var user = request.user,
        promises = [],
        result;

    // Needed to fetch savedTest authors
    Parse.Cloud.useMasterKey();

    promises.push(Parse.Config.get());
    promises.push(new Parse.Query(Category).include("parent").find());

    if (user) {
        var createdTestsQuery = new Parse.Query(Test);
        createdTestsQuery.equalTo('author', user);
        createdTestsQuery.notEqualTo('isObjectDeleted', true);
        createdTestsQuery.notEqualTo('isSpacedRepetition', true);
        createdTestsQuery.ascending('title');
        createdTestsQuery.include('questions');
        createdTestsQuery.limit(25);
        promises.push(createdTestsQuery.find());

        var savedTestsRelation = user.relation('savedTests'),
            savedTestsQuery = savedTestsRelation.query();

        savedTestsQuery.notEqualTo('isObjectDeleted', true);
        savedTestsQuery.notEqualTo('isSpacedRepetition', true);
        savedTestsQuery.ascending('title');
        savedTestsQuery.include('questions', 'author');
        savedTestsQuery.limit(25);
        promises.push(savedTestsQuery.find());

        // Get uniqueResponses only for tests that are being
        // sent to the user in this instance.
        var uniqueResponsesRelation = user.relation('uniqueResponses'),
            uniqueResponsesForCreatedTestsQuery = uniqueResponsesRelation.query(),
            uniqueResponsesForSavedTestsQuery = uniqueResponsesRelation.query();
        // uniqueResponses on createdTests
        uniqueResponsesForCreatedTestsQuery.include('test');
        uniqueResponsesForCreatedTestsQuery.limit(1000);
        uniqueResponsesForCreatedTestsQuery.matchesQuery('test', createdTestsQuery);
        // uniqueResponses on savedTests
        uniqueResponsesForSavedTestsQuery.include('test');
        uniqueResponsesForSavedTestsQuery.limit(1000);
        uniqueResponsesForSavedTestsQuery.matchesQuery('test', createdTestsQuery);
        // Find uniqueResponses in either of the above two queries
        var uniqueResponsesQuery = Parse.Query.or(uniqueResponsesForCreatedTestsQuery,
            uniqueResponsesForSavedTestsQuery);

        // Perform the query, then update memoryStrength + save
        promises.push(UniqueResponse.findWithUpdatedMemoryStrengths(uniqueResponsesQuery));

        if (user.srLatestTest())
            promises.push(user.fetchSRLatestTest());

        // Seems to be a limit of 6 parallel promises
    }
    Parse.Promise.when(promises)
        .then(function (config, categories, createdTests, savedTests, uniqueResponses, srLatestTest) {
            result = {
                config: config,
                categories: categories,
                createdTests: createdTests,
                savedTests: savedTests,
                uniqueResponses: uniqueResponses,
                srLatestTest: srLatestTest
            };
            if (user) {
                // Another 6 promises can go here if need be
                promises = [];
                promises.push(user.fetchEducationCohort());

                return Parse.Promise.when(promises);
            }
        }).then(function (educationCohort) {
            result.educationCohort = educationCohort;
            /* var messagesQuery = new Parse.Query("Message");
             messagesQuery.equalTo('to', user);
             messagesQuery.descending("createdAt");
             messagesQuery.limit(5);
             promises.push(messages = messagesQuery.find());

             var attemptsQuery = new Parse.Query("Attempt");
             attemptsQuery.equalTo('user', user);
             attemptsQuery.descending("createdAt");
             attemptsQuery.equalTo('isProcessed', true);
             attemptsQuery.exists('test');
             attemptsQuery.include('test');
             attemptsQuery.limit(50);
             promises.push(attempts = attemptsQuery.find());

             var followersQuery = user.relation("followers").query();
             promises.push(followers = followersQuery.find());

             var followingQuery = user.relation("following").query();
             promises.push(following = followingQuery.find());

             var groupsQuery = user.relation("groups").query();
             promises.push(groups = groupsQuery.find());*/
            /*if (messages)
             result.messages = messages["_result"][0];
             if (followers)
             result.followers = followers["_result"][0];
             if (following)
             result.following = following["_result"][0];
             if (groups)
             result.groups = groups["_result"][0];
             if (attempts) {
             result.attempts = [];
             _.each(attempts["_result"][0], function (attempt) {
             if (attempt.get('test') && attempt.get('test').id && result.attempts.length < 15)
             result.attempts.push(attempt);
             });
             }*/
            return response.success(result);
        }, function (error) {
            return response.error(error);
        });
});

/**
 * @CloudFunction Create New Test
 * Parse.Cloud.beforeSave does not
 * allow custom response parameters.
 * We need to respond with userEvents
 * or badges: therefore, this custom
 * function saves the test
 * @param {Test} test
 * @return {UserEvent} userEvent
 */
Parse.Cloud.define('createNewTest', function (request, response) {
    var user = request.user,
        testPayload = request.params.test,
        test = Parse.Object.createFromJSON(testPayload, "Test"),
        userEvent;

    test.save().then(function () {
        // Creates a new userEvent and increments the users points.
        return UserEvent.newEvent(UserEvent.CREATED_TEST, test, user);
    }).then(function (result) {
        userEvent = result;
        return user.checkLevelUp();
    }).then(function (didLevelUp) {
        return response.success({userEvent: userEvent, test: test, didLevelUp: didLevelUp});
    }, function (error) {
        response.error(error);
    });
});
/**
 * @CloudFunction Add Question to Test
 * Saves a new question. Creates a user
 * event (hence why Test object is needed).
 * But, does not add question to test.
 * This is because the client will need
 * to update the local Test record anyways.
 *
 * So just send the question payload, a Test
 * pointer, and expect back a userEvent
 * and question. Add the saved question to
 * the Test.questions - save the test normally
 * from the client.
 *
 * @param {Parse.Pointer<Test>} test
 * @param {Question} question
 * @return {UserEvent} userEvent
 */
Parse.Cloud.define('saveNewQuestion', function (request, response) {
    var user = request.user,
        test = request.params.test,
        questionPayload = request.params.question,
        question = Parse.Object.createFromJSON(questionPayload, "Question"),
        userEvent;

    question.save().then(function () {
        // Creates a new userEvent and increments the users points.
        return UserEvent.newEvent(UserEvent.ADDED_QUESTION, [question, test], user);
    }).then(function (result) {
        userEvent = result;
        return user.checkLevelUp();
    }).then(function (didLevelUp) {
        return response.success({userEvent: userEvent, question: question, didLevelUp: didLevelUp});
    }, function (error) {
        response.error(error);
    });
});
/**
 * @CloudFunction New User Event
 * @param {Array<Parse.Object>} objects
 * @param {Array<String>} objectTypes
 * @param {String} type
 * @return {UserEvent} userEvent
 */
Parse.Cloud.define('newUserEvent', function (request, response) {
    var user = request.user,
        testPayload = request.params.test,
        test = Parse.Object.createFromJSON(testPayload, "Test"),
        userEvent;

    test.save().then(function () {
        // Creates a new userEvent and increments the users points.
        return UserEvent.newEvent(UserEvent.CREATED_TEST, test, user);
    }).then(function (result) {
        userEvent = result;
        return user.checkLevelUp();
    }).then(function (didLevelUp) {
        return response.success({userEvent: userEvent, test: test, didLevelUp: didLevelUp});
    }, function (error) {
        response.error(error);
    });
});
/*
 *//**
 * @CloudFunction Save Objects
 * Parse.Cloud.beforeSave does not
 * allow custom response parameters.
 * We need to respond with userEvents
 * or badges: therefore, this custom
 * function saves objects and returns
 * the objects and userEvent(s) and
 * badge(s).
 * @param {Array} objects
 * @return {UserEvent} userEvent
 *//*
 Parse.Cloud.define('saveObjects', function (request, response) {
 var JSONObjects = request.params.objects,
 user = request.user,
 objects = Parse.Object.createFromJSON(JSONObjects);
 test.save().then(function () {
 return UserEvent.createdTest(test, user);
 }).then(function (userEvent) {
 return response.success({userEvent: userEvent, test: test});
 }, function (error) {
 response.error(error);
 });
 });*/

/**
 * @CloudFunction Get Community Test
 *
 * Fetches a test that is not locally stored
 * to the client: response is with questions,
 * category and limited-author profile
 * included.
 *
 * If test does not belong to user, author
 * profile is minimised.
 *
 * @param {string} slug OR,
 * @param {string} testId
 * @return {Test} test
 */
Parse.Cloud.define('getCommunityTest', function (request, response) {
    var user = request.user,
        slug = request.params.slug,
        testId = request.params.testId,
        query = new Parse.Query(Test);

    query.notEqualTo('isObjectDeleted', true);
    if (slug)
        query.equalTo('slug', slug);
    if (testId)
        query.equalTo('objectId', testId);
    query.include('questions', 'author', 'category.parent');

    // Need this to get author.
    Parse.Cloud.useMasterKey();

    query.find().then(function (result) {
        var test = result[0];
        if (!test)
            return response.error("Test not found");
        // Query includes private tests in case the test
        // belongs to the user. We check it manually here.
        if (!test.get('isPublic')) {
            if (!user || user.id !== test.get('author').id)
                return response.error("You do not have permission to view this test.");
        }
        // TODO limit user profile
        response.success(test);
    }, function (error) {
        response.error(error);
    });
});

/**
 * @CloudFunction Save Test Attempt
 * Takes individual responses and saves each one,
 * storing the array of responses in a new attempt
 * record. This reduces number of requests needed
 * from the client's device AND allows us to
 * allocate and return points/badges to the user.
 *
 * @param {Object} attempt
 * @param {Array} responses
 * @return {{attempt: Attempt, userEvent: UserEvent}}
 */
Parse.Cloud.define('saveTestAttempt', function (request, status) {
    var user = request.user,
        JSONAttempt = request.params.attempt,
        JSONResponses = request.params.responses,
        responses = [],
        attempt;

    // Responses need to be saved before the attempt
    _.each(JSONResponses, function (JSONResponse) {
        var response = Parse.Object.createFromJSON(JSONResponse, 'Response');
        responses.push(response);
    });

    Parse.Object.saveAll(responses).then(function () {
        var promises = [];
        // Add responses to attempt payload
        JSONAttempt.responses = responses;
        // Convert attempt payload to Parse Object and save
        attempt = Parse.Object.createFromJSON(JSONAttempt, 'Attempt');
        promises.push(attempt.save());

        // Create or update uniqueResponses
        promises.push(user.addUniqueResponses(responses));

        return Parse.Promise.when(promises);
    }).then(function (attempt, uniqueResponses) {
        status.success({attempt: attempt, uniqueResponses: uniqueResponses});
    }, function (error) {
        status.error(error);
    });
});

/**
 * @CloudFunction Add or Remove Relation
 *
 * A one-size-fits all function, more useful
 * with the website. Use case examples:
 * - Adding or Removing Saved Tests to Users
 *
 * @param {string} parentObjectClass
 * @param {string} parentObjectId
 * @param {string} relationKey
 * @param {boolean} isTaskToAdd
 * @param {string} childObjectClass
 * @param {Array} childObjectIds
 * @return success/error
 */
Parse.Cloud.define('addOrRemoveRelation', function (request, response) {
    var user = request.user,
        parentObjectClass = request.params.parentObjectClass,
        parentObjectId = request.params.parentObjectId,
        parentObject = new Parse.Object(parentObjectClass),
        relationKey = request.params.relationKey,
        isTaskToAdd = request.params.isTaskToAdd,
        childObjectClass = request.params.childObjectClass,
        childObjectIds = request.params.childObjectIds,
        childObjects,
        promises = [];

    parentObject.id = parentObjectId;
    promises.push(parentObject.fetch());

    var query = new Parse.Query(childObjectClass);
    query.containedIn('objectId', childObjectIds);
    promises.push(childObjects = query.find());

    Parse.Promise.when(promises).then(function () {
        var relation = parentObject.relation(relationKey);
        childObjects = childObjects._result["0"];
        if (!childObjects.length)
            return Parse.Promise.error("No Child Objects for the given objectIds in Class found.");
        if (isTaskToAdd)
            relation.add(childObjects);
        else
            relation.remove(childObjects);
        return parentObject.save();
    }).then(function () {
        response.success("Relation updated.");
    }, function (error) {
        response.error({error: error});
    });

});

/**
 * @CloudFunction Create or Get EducationCohort
 * Takes educational institution, study field
 * and current year to find matching cohort
 * or create a new one. Bonus, add graduation
 * year to existing cohort if one is provided
 * here.
 * @param {String} educationalInstitutionId
 * @param {String} studyFieldId (Required if University)
 * @param {String} currentYear (Required if University)
 * @param {Number} graduationYear (optional)
 * @return {EducationCohort} educationCohort
 */
Parse.Cloud.define('createOrGetEducationCohort', function (request, response) {
    var educationalInstitutionId = request.params.educationalInstitutionId,
        studyFieldId = request.params.studyFieldId,
        currentYear = request.params.currentYear,
        graduationYear = request.params.graduationYear;

    if (!educationalInstitutionId)
        return response.error("Educational Institution Id is needed.");

    var educationalInstitution = new Institution(),
        studyField = new StudyField(),
        promises = [];

    educationalInstitution.id = educationalInstitutionId;
    studyField.id = studyFieldId;
    promises.push(educationalInstitution.fetch());
    if (studyFieldId)
        promises.push(studyField.fetch());
    Parse.Promise.when(promises).then(function () {
        var query = new Parse.Query(EducationCohort);
        query.equalTo('institution', educationalInstitution);
        if (studyFieldId)
            query.equalTo('studyField', studyField);
        if (currentYear)
            query.equalTo('currentYear', currentYear);
        return query.find();
    }).then(function (results) {
        Parse.Cloud.useMasterKey(); // Cannot edit existing EducationCohort objects w/o masterkey.
        var educationCohort = results[0];
        if (educationCohort) {
            if (!educationCohort.get('graduationYear') && graduationYear) {
                educationCohort.set('graduationYear', graduationYear);
                return educationCohort.save();
            } else
                return educationCohort;
        } else {
            educationCohort = new EducationCohort();
            educationCohort.set('institution', educationalInstitution);
            if (studyFieldId)
                educationCohort.set('studyField', studyField);
            if (currentYear)
                educationCohort.set('currentYear', currentYear);
            if (graduationYear)
                educationCohort.set('graduationYear', graduationYear);
            var ACL = new Parse.ACL();
            ACL.setPublicReadAccess(true);
            educationCohort.setACL(ACL);
            return educationCohort.save();
        }
    }).then(function (educationCohort) {
        response.success(educationCohort);
    }, function (error) {
        response.error(error);
    });
});
/**
 * @CloudFunction Create or Update EducationalInstitution
 * EducationalInstitution.name is the key unique factor
 * Can be added by user input, from facebook
 * search or updated to include facebookId.
 * Will return a new or updated educationalInstitution.
 *
 * @param {String} name
 * @param {String} type (e.g. University)
 * @param {String} facebookId (optional)
 * @return {Institution} educationalInstitution
 */
Parse.Cloud.define('createOrUpdateEducationalInstitution', function (request, response) {
    var name = request.params.name,
        facebookId = request.params.facebookId,
        type = request.params.type,
        educationalInstitution;

    if (!name)
        return response.error("Please send a 'name' for the new EducationalInstitution.");

    name = name.capitalizeFirstLetter();
    var query = new Parse.Query(Institution);
    query.equalTo('name', name);
    Parse.Cloud.useMasterKey();
    query.find().then(function (results) {
        if (results[0]) {
            educationalInstitution = results[0];
            // If existing study field has no facebookId and we have one here, set it
            if ((!educationalInstitution.get('facebookId') || !educationalInstitution.get('facebookId').length) &&
                facebookId) {
                educationalInstitution.set('facebookId', facebookId);
                return educationalInstitution.save();
            } else
                return educationalInstitution;
        } else {
            educationalInstitution = new Institution();
            educationalInstitution.set('name', name);
            educationalInstitution.set('type', type);
            if (facebookId)
                educationalInstitution.set('facebookId', facebookId);
            return educationalInstitution.save();
        }
    }).then(function () {
        response.success(educationalInstitution);
    }, function (error) {
        response.error(error);
    });
});
/**
 * @CloudFunction Create or Update StudyField
 * StudyField.name is the key unique factor
 * Can be added by user input, from facebook
 * search or updated to include facebookId.
 * Will return a new or updated studyField.
 *
 * @param {string} name
 * @param {string} facebookId (optional)
 * @return {StudyField} studyField
 */
Parse.Cloud.define('createOrUpdateStudyField', function (request, response) {
    var name = request.params.name,
        facebookId = request.params.facebookId,
        studyField;

    if (!name)
        return response.error("Please send a 'name' for the new StudyField.");

    name = name.capitalizeFirstLetter();
    var query = new Parse.Query(StudyField);
    query.equalTo('name', name);
    Parse.Cloud.useMasterKey();
    query.find()
        .then(function (results) {
            if (results[0]) {
                studyField = results[0];
                // If existing study field has no facebookId and we have one here, set it
                if ((!studyField.get('facebookId') || !studyField.get('facebookId').length) && facebookId) {
                    studyField.set('facebookId', facebookId);
                    return studyField.save();
                } else
                    return studyField;
            } else {
                studyField = new StudyField();
                studyField.set('name', name);
                if (facebookId)
                    studyField.set('facebookId', facebookId);
                return studyField.save();
            }
        }).then(function () {
            response.success(studyField);
        }, function (error) {
            response.error(error);
        });
});
/**
 * @CloudFunction Set Education Cohort using Facebook
 * Loops through education history to find the
 * education object with the latest graduation year.
 * Uses the concentration to create/get a studyField,
 * and school to create/get an educationalInstitution.
 *
 * Note, 'currentYear', is not given by Facebook.
 * Therefore, the educationCohort is NOT saved by this
 * function. You must confirm the details with the user
 * on client-side and call createOrGetEducationCohort.
 * @param {Object} educationHistory
 * @return {Instituion, StudyField, Integer} educationalInstitution, studyField, graduationYear
 */
Parse.Cloud.define('setEducationCohortUsingFacebook', function (request, response) {
    Parse.Cloud.useMasterKey();
    var educationHistory = request.params.educationHistory;

    if (!educationHistory)
        return response.error("Please send a valid Facebook education history object.");
    else if (!educationHistory.length)
        return response.error("The education history is empty.");

    var latestGraduationYear = 0,
        latestEducation;
    _.each(educationHistory, function (education) {
        if (education.year && education.year.name && parseInt(education.year.name) > latestGraduationYear) {
            latestGraduationYear = parseInt(education.year.name);
            latestEducation = education;
        }
    });
    if (!latestEducation)
        latestEducation = educationHistory[0];

    var educationalInstitution,
        studyField,
        graduationYear = latestGraduationYear;
    Parse.Cloud.run('createOrUpdateEducationalInstitution', {
        name: latestEducation.school.name,
        type: latestEducation.type,
        facebookId: latestEducation.school.id
    }).then(function (result) {
        educationalInstitution = result;
        if (!latestEducation.concentration)
            return;
        return Parse.Cloud.run('createOrUpdateStudyField', {
            name: latestEducation.concentration[0].name,
            facebookId: latestEducation.concentration[0].id
        });
    }).then(function (result) {
        studyField = result;
        response.success({
            educationalInstitution: educationalInstitution,
            studyField: studyField, graduationYear: graduationYear
        });
    }, function (error) {
        return response.error(error);
    });
});

/**
 * @CloudFunction Change Password
 * Simple function to change a user's
 * password by request. Must send
 * old (current) password and a new
 * password which fits our password
 * characteristics criteria (to be
 * fetched via config).
 *
 * @param {String} oldPassword
 * @param {String} newPassword
 * @return {String} status
 */
Parse.Cloud.define('changePassword', function (request, response) {
    Parse.Cloud.useMasterKey();
    var oldPassword = request.params.oldPassword,
        newPassword = request.params.newPassword,
        user = request.user;

    if (!user)
        return response.error("Unauthorised request. Please log in.");

    if (!oldPassword || !newPassword)
        return response.error("You must send an old and new password.");

    Parse.User.logIn(user.getUsername(), oldPassword).then(function () {
        // correct
        user.set('password', newPassword);
        return user.save();
    }, function () {
        // incorrect
        return Parse.Promise.error("The old password you provided was incorrect.");
    }).then(function () {
        response.success("Password changed.");
    }, function (error) {
        response.error(error);
    });
});

/**
 * @CloudFunction Activate Spaced Repetition for User
 * Activates spaced practice for the user and
 * sets defaults such as intensity, notification
 * methods and do not disturb times.
 * @return {Object} {srDoNotDisturbTimes}
 */
Parse.Cloud.define('activateSpacedRepetitionForUser', function (request, response) {
    var user = request.user;
    if (!user)
        return response.error("Must be logged in.");

    user.set('srActivated', true);
    user.set('srIntensityLevel', 2);
    user.set('srNotifyByEmail', true);
    // TODO check if user has app.
    user.set('srNotifyByPush', false);
    user.set('srNextDue', moment().add(1, 'minute'));

    var doNotDisturbTimes = [];
    Parse.Config.get().then(function (config) {
        var dailySlots = config.get('srDailySlots'),
            week = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

        _.each(week, function (dayName) {
            var day = {
                "label": dayName,
                "slots": []
            };
            _.each(dailySlots, function (slot) {
                var daySlot = _.clone(slot);
                if (((dayName === "Thursday" || dayName === "Friday") && slot.label === "evening") ||
                    ((dayName === "Saturday" || dayName === "Sunday") && slot.label === "morning"))
                    daySlot.active = true;
                else
                    daySlot.active = false;
                day.slots.push(daySlot);
            });
            doNotDisturbTimes.push(day);
        });
        user.set('srDoNotDisturbTimes', doNotDisturbTimes);
        return user.save();
    }).then(function () {
        response.success();
    }, function (error) {
        response.error(error);
    });

});

/**
 * @CloudFunction Map Old Tests to New
 *
 * Used to migrate MyCQs tests to Synap.
 * Work in progress.
 *
 * Currently creates new tests or updates
 * previously added tests, to a pre-existing
 * Synap user.
 *
 * @param {string} authorId
 * @param {string} oldTests
 * @return success/error
 */
Parse.Cloud.define('mapOldTestsToNew', function (request, response) {
    var author = new Parse.User(),
        oldTests = request.params.tests.results,
        tests = [],
        promises = [];

    if (request.params.key !== "Xquulpwz1!")
        return response.error("Unauthorized request!");

    Parse.Cloud.useMasterKey();

    author.id = request.params.authorId;

    author.fetch().then(function () {
        _.each(oldTests, function (oldTest) {
            if (oldTest.isGenerated || !oldTest.category || oldTest.isObjectDeleted)
                return;

            var test = new Test();
            test.set('slug', oldTest.slug);
            test.set('title', oldTest.title);
            test.set('author', author);
            test.set('description', oldTest.description);
            test.set('averageScore', oldTest.averageScore);
            test.set('averageUniqueScore', oldTest.uniqueAverageScore);
            test.set('numberOfAttempts', oldTest.numberOfAttempts);
            test.set('numberOfUniqueAttempts', oldTest.uniqueNumberOfAttempts);
            test.set('quality', oldTest.quality);
            test.set('isPublic', !!oldTest.privacy);
            test.set('category', oldTest.category);

            var questions = [];
            _.each(oldTest.questions, function (oldQuestion) {
                var question = new Question();
                question.set('stem', oldQuestion.stem());
                question.set('feedback', oldQuestion.feedback());
                question.set('numberOfResponses', oldQuestion.get('numberOfTimesTaken'));
                question.set('numberOfCorrectResponses', oldQuestion.get('numberAnsweredCorrectly'));
                question.set('options', oldQuestion.options());
                question.set('isPublic', test.isPublic());
                // setDefaults is normally called beforeSave
                // but requires the user - not present when called
                // from CC. Therefore, call now with the author.
                question.setDefaults(author);
                questions.push(question);
            });
            var promise = Parse.Object.saveAll(questions).then(function () {
                test.set('questions', questions);
                tests.push(test);
                return test.save();
            });
            return promises.push(promise);
        });
        return Parse.Promise.when(promises);
    }).then(function () {
        var createdTests = author.createdTests();
        createdTests.add(tests);
        return author.save();
    }).then(function () {
        response.success("Added " + tests.length + " tests for " + author.name());
    }, function (error) {
        response.error(error);
    });
});