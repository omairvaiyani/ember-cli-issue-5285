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
 * - User's tests
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
        tests,
        promises = [];

    promises.push(config = Parse.Config.get());
    promises.push(categories = new Parse.Query("Category").include("parent").find());
    if (user) {
        var testsQuery = new Parse.Query(Test);
        testsQuery.equalTo('author', user);
        testsQuery.notEqualTo('isObjectDeleted', true);
        testsQuery.notEqualTo('isSpacedRepetition', true);
        testsQuery.ascending('title');
        testsQuery.limit(1000);
        promises.push(tests = testsQuery.find());

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
        if (tests)
            result.tests = tests["_result"][0];
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