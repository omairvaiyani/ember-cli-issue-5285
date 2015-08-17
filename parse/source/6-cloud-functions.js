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
 * - Created tests (limit 200)
 * - Saved tests (limit 200)
 * - Unique responses (limit 1000)
 * - srLatestTest
 * - srAllTests (limit 10)
 * - latestTestAttempts (limit 400)
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
        createdTestsQuery.limit(200);
        promises.push(createdTestsQuery.find());

        var savedTestsRelation = user.relation('savedTests'),
            savedTestsQuery = savedTestsRelation.query();

        savedTestsQuery.notEqualTo('isObjectDeleted', true);
        savedTestsQuery.notEqualTo('isSpacedRepetition', true);
        savedTestsQuery.ascending('title');
        savedTestsQuery.include('questions', 'author');
        savedTestsQuery.limit(200);
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

        if (user.srLatestTest()) {
            promises.push(user.fetchSRLatestTest());
        }

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
                if (user.educationCohort())
                    promises.push(user.fetchEducationCohort());

                var srAllTestsQuery = user.srAllTests().query();
                srAllTestsQuery.descending('createdAt');
                srAllTestsQuery.limit(10);
                promises.push(srAllTestsQuery.find());

                var latestTestAttemptsQuery = user.latestTestAttempts().query();
                // Get latest scores for all myTests list tests AND latest SR test
                var testsToGetLatestAttemptsFor = createdTests.concat(savedTests);
                if (srLatestTest)
                    testsToGetLatestAttemptsFor.push(srLatestTest);

                latestTestAttemptsQuery.containedIn('test', testsToGetLatestAttemptsFor);
                latestTestAttemptsQuery.limit(400);
                latestTestAttemptsQuery.descending("createdAt");
                promises.push(latestTestAttemptsQuery.find());

                return Parse.Promise.when(promises);
            }
        }).then(function (educationCohort, srAllTests, latestTestAttempts) {
            result.educationCohort = educationCohort;
            result.srAllTests = srAllTests;
            result.latestTestAttempts = latestTestAttempts;
            /* var messagesQuery = new Parse.Query("Message");
             messagesQuery.equalTo('to', user);
             messagesQuery.descending("createdAt");
             messagesQuery.limit(5);
             promises.push(messages = messagesQuery.find());

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
 * @CloudFunction Get Memory Strength for Tests
 * You can send an array of tests, test pointers or test objectIds.
 * @param {Array<Test> || Array<pointers> || Array<String>} tests
 */
Parse.Cloud.define('getMemoryStrengthForTests', function (request, response) {
    var user = request.user,
        tests = request.params.tests,
        uniqueResponses;

    if (!user || !tests || !tests.length)
        return response.error("You must be logged in and send tests.");

    // Get Tests first
    var testQuery = new Parse.Query(Test),
        testIds;

    if (typeof tests[0] === "string")
        testIds = tests;
    else
        testIds = _.map(tests, function (test) {
            return test.id;
        });

    testQuery.containedIn("objectId", testIds);
    testQuery.find().then(function (tests) {
        var questionPointers = [];

        _.each(tests, function (test) {
            if (test.questions()) {
                _.each(test.questions(), function (question) {
                    questionPointers.push(question);
                });
            }
        });

        var urQuery = user.uniqueResponses().query();

        urQuery.containedIn('question', questionPointers);
        urQuery.limit(1000);

        Parse.Cloud.useMasterKey();
        return UniqueResponse.findWithUpdatedMemoryStrengths(urQuery);
    }).then(function (response) {
        uniqueResponses = response;
        var testIdsWithUrs = [];

        _.each(uniqueResponses, function (uniqueResponse) {
            testIdsWithUrs.push(uniqueResponse.test().id);
        });

        testIdsWithUrs = _.uniq(testIdsWithUrs);

        var testsWithoutURs = _.filter(tests, function (test) {
            return !_.contains(testIdsWithUrs, test.id);
        });

        return user.estimateMemoryStrengthForTests(testsWithoutURs);
    }).then(function (estimatedMemoryStrengths) {
        response.success({
            estimates: estimatedMemoryStrengths,
            uniqueResponses: uniqueResponses
        });
    }, function (error) {
        response.error(error);
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
 * @CloudFunction Delete Objects
 *
 * For certain types of objects,
 * we do not want to permanently
 * remove the object from our server,
 * therefore, we'll set a flag
 * and masterkey only ACLs.
 *
 * Rest will simply be destroyed.
 *
 * @param {string} className
 * @param {Array} objects (pointers)
 * @return {*}
 */
Parse.Cloud.define('deleteObjects', function (request, response) {
    var objectPointers = request.params.objects,
        className = request.params.className,
        user = request.user,
        promise;

    if (!className || !objectPointers.length || !user)
        return response.error("Send className and object pointer. And be logged in.");

    var objectQuery = new Parse.Query(className);
    objectQuery.containedIn("objectId", _.map(objectPointers, function (pointer) {
        return pointer.id;
    }));

    switch (className) {
        case "Test":
        case "Question":
            promise = objectQuery.each(function (object) {
                object.set('isObjectDeleted', true);
                object.set('isPublic', false);
                object.setACL(new Parse.ACL());
                return object.save();
            });
            break;
        default:
            promise = objectQuery.each(function (object) {
                return object.destroy();
            });
            break;
    }
    promise.then(function () {
        response.success();
    }, function (error) {
        response.error(error);
    });
});
/**
 * // TODO, this needs a revision
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
 * @Deprecated, using Search Index instead.
 * @CloudFunction Get Community Tests
 *
 * Conducts a test query.
 * Response is with questions,
 * category and limited-author profile
 * included.
 *
 * If test does not belong to user, author
 * profile is minimised.
 *
 * @param {Array} queryOptions
 * @return {Array<Test>}
 */
Parse.Cloud.define('getCommunityTests', function (request, response) {
    var queryOptions = request.params.queryOptions,
        query = new Parse.Query(Test);

    query.notEqualTo('isObjectDeleted', true);
    query.include('questions', 'author', 'category');


    _.each(queryOptions, function (queryOption) {
        if (queryOption.key && queryOption.value)
            query[queryOption.method](queryOption.key, queryOption.value);
        else if (queryOption.value)
            query[queryOption.method](queryOption.value);
        else if (queryOption.key)
            query[queryOption.method](queryOption.key);
    });
    // Need this to get author.
    Parse.Cloud.useMasterKey();

    query.find().then(function (result) {
        var tests = [];
        // Query includes private tests in case the test
        // belongs to the user. We check it manually here.
        _.each(result, function (test) {
            if (test.get('isPublic'))
                tests.push(test);
            // TODO limit user profile
        });
        response.success(tests);
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
 * @CloudFunction Get EducationCohort
 * Creates or gets educational institution, study field
 * and current year to find or create an education-cohort.
 * @param {String} institutionName
 * @param {String} institutionId
 * @param {String} institutionType
 * @param {String} studyFieldName
 * @param {String} studyFieldId
 * @param {String} studyFieldFacebookId
 * @param {Array<String>} moduleTags
 * @param {String} currentYear (Required if University)
 * @return {EducationCohort} educationCohort
 */
Parse.Cloud.define('getEducationCohort', function (request, response) {
    var institutionName = request.params.institutionName,
        institutionId = request.params.institutionId,
        institutionType = request.params.institutionType,
        institutionFacebookId = request.params.institutionFacebookId,
        studyFieldName = request.params.studyFieldName,
        studyFieldId = request.params.studyFieldId,
        studyFieldFacebookId = request.params.studyFieldFacebookId,
        moduleTags = request.params.moduleTags,
        institution,
        studyField,
        currentYear = request.params.currentYear,
        promises = [];

    if (!institutionName && !studyFieldName && !institutionId && !studyFieldId)
        return response.error("Institution and/or Study Field name or id is needed.");

    promises.push(Parse.Cloud.run('createOrUpdateInstitution',
        {
            name: institutionName, type: institutionType, facebookId: institutionFacebookId,
            id: institutionId
        }));

    promises.push(Parse.Cloud.run('createOrUpdateStudyField',
        {name: studyFieldName, facebookId: studyFieldFacebookId, id: studyFieldId}));

    Parse.Promise.when(promises).then(function (a, b) {
        institution = a;
        studyField = b;

        var query = new Parse.Query(EducationCohort);
        if (!institution || !studyField)
            return;

        if (institution)
            query.equalTo('institution', institution);
        if (studyField)
            query.equalTo('studyField', studyField);
        if (currentYear)
            query.equalTo('currentYear', currentYear);
        return query.find();
    }).then(function (results) {
        Parse.Cloud.useMasterKey(); // Cannot edit existing EducationCohort objects w/o masterkey.
        var educationCohort;
        if (results)
            educationCohort = results[0];
        if (educationCohort) {
            if ((!educationCohort.get('moduleTags') || !educationCohort.get('moduleTags').length) && moduleTags) {
                // TODO append more if some tags already exist?
                educationCohort.set('moduleTags', moduleTags);
                return educationCohort.save();
            }
            return educationCohort;
        } else {
            educationCohort = new EducationCohort();
            educationCohort.set('institution', institution);
            educationCohort.set('studyField', studyField);
            educationCohort.set('currentYear', currentYear);
            educationCohort.set('moduleTags', moduleTags ? moduleTags : moduleTags);
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
 * @Deprecated use "getEducationCohort" instead.
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
 * @CloudFunction Create or Update Institution
 * institution.name or id is the key unique factor
 * Can be added by user input, from facebook
 * search or updated to include facebookId.
 * Will return a new or updated educationalInstitution.
 *
 * @param {String} name (either this or id)
 * @param {String} id (either this or name)
 * @param {String} type (university, school, company, home, undefined)
 * @param {String} facebookId (optional)
 * @return {Institution} educationalInstitution
 */
Parse.Cloud.define('createOrUpdateInstitution', function (request, response) {
    var name = request.params.name,
        id = request.params.id,
        facebookId = request.params.facebookId,
        type = request.params.type,
        institution,
        query = new Parse.Query(Institution);

    if (!name && !id)
        return response.error("Please send a 'name' or 'id' for the new Institution.");

    if (name) {
        name = name.capitalizeFirstLetter();
        query.equalTo('name', name);
    } else {
        query.equalTo('objectId', id);
    }

    Parse.Cloud.useMasterKey();
    query.find().then(function (results) {
        if (results[0]) {
            institution = results[0];
            // If existing study field has no facebookId and we have one here, set it
            if ((!institution.get('facebookId') || !institution.get('facebookId').length) &&
                facebookId) {
                institution.set('facebookId', facebookId);
                return institution.save();
            } else
                return institution;
        } else {
            institution = new Institution();
            institution.set('name', name);
            institution.set('type', type);
            if (facebookId)
                institution.set('facebookId', facebookId);
            return institution.save();
        }
    }).then(function () {
        response.success(institution);
    }, function (error) {
        response.error(error);
    });
});
/**
 * @CloudFunction Create or Update StudyField
 * StudyField.name or id is the key unique factor
 * Can be added by user input, from facebook
 * search or updated to include facebookId.
 * Will return a new or updated studyField.
 *
 * @param {string} name (either this or id)
 * @param {string} id (either this or name)
 * @param {string} facebookId (optional)
 * @return {StudyField} studyField
 */
Parse.Cloud.define('createOrUpdateStudyField', function (request, response) {
    var name = request.params.name,
        id = request.params.id,
        facebookId = request.params.facebookId,
        studyField,
        query = new Parse.Query(StudyField);

    if (!name && !id)
        return response.error("Please send a 'name' or id for the new StudyField.");

    if (name) {
        name = name.capitalizeFirstLetter();
        query.equalTo('name', name);
    } else {
        query.equalTo("objectId", id);
    }

    Parse.Cloud.useMasterKey();
    query.find()
        .then(function (results) {
            if (results[0]) {
                studyField = results[0];
                var changesMade = false;
                // If existing study field has no facebookId and we have one here, set it
                if ((!studyField.get('facebookId') || !studyField.get('facebookId').length) && facebookId) {
                    studyField.set('facebookId', facebookId);
                    changesMade = true;
                }
                if (changesMade)
                    return studyField.save();
                else
                    return studyField;
            } else {
                studyField = new StudyField();
                studyField.set('name', name);
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
 * @return {Institution, StudyField, Integer} educationalInstitution, studyField, graduationYear
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
                // Set which slots should be active by default
                var daySlot = _.clone(slot);
                daySlot.active = ((dayName === "Thursday" || dayName === "Friday") && slot.label === "evening") ||
                    ((dayName === "Saturday" || dayName === "Sunday") && slot.label === "morning");

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

/**                      **/
/** MIGRATION CODE BELOW **/
/**                      **/

/**
 * @Property MyCQs API
 * Used for migration purposes.
 * @type {{appId: string, restKey: string}}
 */
var MyCQsAPI = {
    appId: "DjQgBjzLml5feb1a34s25g7op7Zqgwqk8eWbOotT",
    restKey: "xN4I6AYSdW2P8iufiEOEP1EcbiZtdqyjyFBsfOrh"
};
/**
 * @CloudFunction Check If User Exists on MyCQs
 *
 * Send email and password, ideally whilst logged in.
 * This function calls the MyCQs API to login and confirm
 * that the user existed on MyCQs.
 *
 * @param {string} email
 * @param {string} password (if not a FB user)
 */
Parse.Cloud.define('checkIfUserExistsOnMyCQs', function (request, response) {
    var email = request.params.email,
        password = request.params.password;

    if (!email) {
        return response.error("You must be send your email.");
    }
    Parse.Cloud.httpRequest({
        method: 'POST',
        url: 'https://api.parse.com/1/functions/preLogIn',
        headers: {
            "X-Parse-Application-Id": MyCQsAPI.appId,
            "X-Parse-REST-API-Key": MyCQsAPI.restKey,
            "Content-Type": "application/json; charset=utf-8"
        },
        body: {
            email: email,
            secretKey: "Xquulpwz1!"
        }
    }).then(function (httpResponse) {
        var result = httpResponse.data.result,
            url,
            params,
            body,
            method;

        if (result.user.authData && result.user.authData.facebook) {
            method = "POST";
            url = 'https://api.parse.com/1/users';
            body = {
                authData: result.user.authData
            };
        } else {
            method = "GET";
            url = 'https://api.parse.com/1/login';
            params = {
                username: result.username,
                password: password
            };
        }
        return Parse.Cloud.httpRequest({
            method: method,
            url: url,
            headers: {
                "X-Parse-Application-Id": "DjQgBjzLml5feb1a34s25g7op7Zqgwqk8eWbOotT",
                "X-Parse-REST-API-Key": "xN4I6AYSdW2P8iufiEOEP1EcbiZtdqyjyFBsfOrh",
                "Content-Type": "application/json; charset=utf-8"
            },
            params: params,
            body: body
        });
    }).then(function (httpResponse) {
        response.success(httpResponse.data);
    }, function (httpResponse) {
        response.error('Request failed with response code ' + httpResponse.status);
    });
});
/**
 * @CloudFunction Get Old Tests for User
 *
 * This returns the user's old tests
 * from MyCQs in the *old* format.
 * Use this to show to the user
 * what tests they want to migrate
 * over. Then, use the 'mapOldTestsToNew'
 * CF to continue migration.
 *
 * Get the sessionToken and authorId
 * *OLD authorId* using the
 * 'checkIfUserExistsOnMyCQs' CF.
 *
 * @param {string} sessionToken
 * @param {string} authorId
 * @return {Array}
 */
Parse.Cloud.define('getOldTestsForUser', function (request, response) {
    var sessionToken = request.params.sessionToken,
        authorId = request.params.authorId;

    if (!sessionToken || !authorId)
        return response.error("You must send a MyCQs sessionToken and authorId.");

    var where = {
            author: generatePointer(authorId, "_User"),
            isObjectDeleted: {"$ne": true},
            isGenerated: {"$ne": true}
        },
        url = "https://api.parse.com/1/classes/Test?where=" + JSON.stringify(where) + "&limit=1000";
    url += "&include=questions";
    Parse.Cloud.httpRequest({
        method: 'GET',
        url: url,
        headers: {
            "X-Parse-Application-Id": MyCQsAPI.appId,
            "X-Parse-REST-API-Key": MyCQsAPI.restKey,
            "Content-Type": "application/json; charset=utf-8",
            "X-Parse-Session-Token": sessionToken
        }
    }).then(function (httpResponse) {
        response.success(httpResponse.data.results);
    }, function (error) {
        response.error(error);
    });
});
/**
 * @CloudFunction Map Old Tests to New
 *
 * Used to migrate MyCQs tests to Synap.
 *
 * Currently creates new tests or updates
 * previously added tests, to a pre-existing
 * Synap user.
 *
 * Must send 'oldTests' in the MyCQs format.
 * Do not send more than 25 tests at one time,
 * this will avoid timeouts and max data limits.
 *
 * @param {string} key "Xquulpwz1!"
 * @param {Array} oldTests
 * @return success/error
 */
Parse.Cloud.define('mapOldTestsToNew', function (request, response) {
    var user = request.user,
        oldTests = request.params.oldTests,
        tests = [],
        promises = [];

    if (!user)
        return response.error("Please log in first!");

    Parse.Cloud.useMasterKey();

    _.each(oldTests, function (oldTest) {
        if (!oldTest.category)
            return;

        var test = new Test();
        // alreadyMigratedId is set on the Web during migration selection
        // it allows us to update tests instead of creating duplicates.
        if (oldTest.alreadyMigratedId)
            test.id = oldTest.alreadyMigratedId;
        test.set('slug', oldTest.slug);
        test.set('title', oldTest.title);
        test.set('author', user);
        test.set('description', oldTest.description);
        test.set('averageScore', oldTest.averageScore);
        test.set('averageUniqueScore', oldTest.uniqueAverageScore);
        test.set('numberOfAttempts', oldTest.numberOfAttempts);
        test.set('numberOfUniqueAttempts', oldTest.uniqueNumberOfAttempts);
        test.set('quality', oldTest.quality);
        test.set('isPublic', !!oldTest.privacy);
        test.set('category', oldTest.category);
        test.set('oldId', oldTest.objectId);

        var questions = [];
        _.each(oldTest.questions, function (oldQuestion) {
            var question = new Question();
            question.set('stem', oldQuestion.get("stem"));
            question.set('feedback', oldQuestion.get("feedback"));
            question.set('numberOfResponses', oldQuestion.get('numberOfTimesTaken'));
            question.set('numberOfCorrectResponses', oldQuestion.get('numberAnsweredCorrectly'));
            question.set('options', oldQuestion.get('options'));
            question.set('isPublic', test.isPublic());
            // setDefaults is normally called beforeSave
            // but requires the user - not present when called
            // from CC. Therefore, call now with the author.
            question.setDefaults(user);
            questions.push(question);
        });
        var promise = Parse.Object.saveAll(questions).then(function () {
            test.set('questions', questions);
            tests.push(test);
            return test.save();
        });
        return promises.push(promise);
    });
    Parse.Promise.when(promises)
        .then(function () {
            var createdTests = user.createdTests();
            createdTests.add(tests);
            return user.save();
        }).then(function () {
            response.success(tests);
        }, function (error) {
            response.error(error);
        });
});