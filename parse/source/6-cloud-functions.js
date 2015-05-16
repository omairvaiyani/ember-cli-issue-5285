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
 * - Created tests
 * - Saved tests
 * - New messages
 * - Followers
 * - Following
 * - Groups
 * - Recent attempts
 */
Parse.Cloud.define("initialiseWebsiteForUser", function (request, response) {
    var user = request.user,
        config,
        categories,
        createdTests,
        savedTests,
        promises = [];

    // Needed to fetch savedTest authors
    Parse.Cloud.useMasterKey();

    promises.push(config = Parse.Config.get());
    promises.push(categories = new Parse.Query("Category").include("parent").find());

    if (user) {
        var createdTestsQuery = new Parse.Query(Test);
        createdTestsQuery.equalTo('author', user);
        createdTestsQuery.notEqualTo('isObjectDeleted', true);
        createdTestsQuery.notEqualTo('isSpacedRepetition', true);
        createdTestsQuery.ascending('title');
        createdTestsQuery.include('questions');
        createdTestsQuery.limit(1000);
        promises.push(createdTests = createdTestsQuery.find());

        var savedTestsRelation = user.relation('savedTests'),
            savedTestsQuery = savedTestsRelation.query();

        savedTestsQuery.notEqualTo('isObjectDeleted', true);
        savedTestsQuery.notEqualTo('isSpacedRepetition', true);
        savedTestsQuery.ascending('title');
        savedTestsQuery.include('questions');
        savedTestsQuery.include('author');
        savedTestsQuery.limit(1000);
        promises.push(savedTests = savedTestsQuery.find());

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
    }
    Parse.Promise.when(promises).then(function () {
        var result = {
            config: config,
            categories: categories["_result"][0]
        };
        if (createdTests)
            result.createdTests = createdTests["_result"][0];

        if (savedTests)
            result.savedTests = savedTests["_result"][0];

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
        console.log("Did level up "+didLevelUp);
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