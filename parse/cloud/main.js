/*
 * PARSE OBJECTS
 */
/****
 * -----------
 * Parse.Object
 * -----------
 * Added functions to the Parse.Object Class
 **/
/**
 * @Function Verify Slug
 *
 * Checks if the currently set slug is
 * unique. If taken, we increment a number
 * at the end of the slug. Mitigation:
 * - Duplicates found but original deleted,
 * set as original
 * - Duplicates count does not match numbers,
 * set highest number from previous
 *
 * @returns {RSVP.Promise}
 */
Parse.Object.prototype.verifySlug = function () {
    Parse.Cloud.useMasterKey();
    var query = new Parse.Query(this.className);

    query.startsWith('slug', this.get('slug'));
    return query.find().then(function (results) {
        if (results.length) {
            var isNumberlessAvailable = true,
                currentHighestNumber = 0;
            _.each(results, function (object) {
                var number = object.get('slug').slice(-1);
                if (isNaN(number))
                    isNumberlessAvailable = false;
                else if (number > currentHighestNumber)
                    currentHighestNumber = number;
            });
            if (!isNumberlessAvailable)
                this.set('slug', this.get('slug') + (currentHighestNumber + 1));
            return this;
        } else
            return this;
    }.bind(this));
};
/****
 * -----------
 * Parse.User
 * -----------
 * Added functions to the Parse.User Class
 **/
/**
 * @Function Set Defaults
 * Adds 0, booleans and empty arrays to
 * default properties. This reduces
 * errors further down the line.
 * @returns {Parse.User}
 */
Parse.User.prototype.setDefaults = function () {
    var numberProps = ["numberOfTestsCreated", "numberOfQuestionsCreated", "averageScore",
        "averageUniqueScore", "numberOfAttempts", "numberOfUniqueAttempts",
        "numberOfAttemptsByCommunity", "numberOfUniqueAttemptsByCommunity",
        "averageScoreByCommunity", "averageUniqueScoreByCommunity", "numberFollowing",
        "numberOfFollowers", "points", "srIntensityLevel"];
    _.each(numberProps, function (prop) {
        this.set(prop, 0);
    }.bind(this));

    var arrayProps = ["emailNotifications", "pushNotifications", "earnedBadges",
        "badgeProgressions"];
    _.each(arrayProps, function (prop) {
        this.set(prop, []);
    }.bind(this));

    this.set('isPremium', false);

    return this;
};
/**
 * @Function Generate Slug
 * Creates a slug locally then
 * calls @verifySlug to query
 * and modify the slug if needed.
 * @returns {RSVP.Promise}
 */
Parse.User.prototype.generateSlug = function () {
    var name = this.get('name'),
        names = name.split(" "),
        slug;

    switch (names.length) {
        case 1:
            slug = names[0].toLowerCase();
            break;
        default:
            var firstInitial = names[0].charAt(0),
                lastName = names[names.length - 1];
            slug = (firstInitial + lastName).toLowerCase();
            break;
    }

    this.set('slug', slug);

    return this.verifySlug();
};
/****
 * ----
 * Test
 * ----
 *
 **/
var Test = Parse.Object.extend("Test", {
    /**
     * @Property title
     * @returns {string}
     */
    title: function () {
        return this.get('title');
    },

    /**
     * @Property author
     * @returns {Parse.User}
     */
    author: function () {
        return this.get('author');
    },

    /**
     * @Property privacy
     * @returns {integer}
     */
    privacy: function () {
        return this.get('privacy');
    },

    /**
     * @Property isGenerated
     * @returns {boolean}
     */
    isGenerated: function () {
        return this.get('isGenerated');
    },

    /**
     * @Function Set Defaults
     * Adds 0, booleans and empty arrays to
     * default properties. This reduces
     * errors further down the line.
     *
     * ACL
     * If privacy === 1
     * {author: read/write, public: read}
     * else
     * {author: read/write}
     *
     * @returns {Test}
     */
    setDefaults: function () {
        var numberProps = ["quality", "averageScore",
            "averageUniqueScore", "numberOfAttempts", "numberOfUniqueAttempts"];

        _.each(numberProps, function (prop) {
            this.set(prop, 0);
        }.bind(this));

        if(!this.get('questions'))
            this.set('questions', []);

        if(this.author()) {
            var ACL = new Parse.ACL(this.author());
            if(this.privacy() === 1)
                ACL.setPublicReadAccess(true);
            this.setACL(ACL);
        }

        return this;
    },

    /**
     * @Function Generate Slug
     * Creates a slug locally then
     * calls @verifySlug to query
     * and modify the slug if needed.
     * @returns {RSVP.Promise}
     */
    generateSlug: function (user) {
        var title = this.get('title'),
            slug = user.get('slug') + "-" + title.slugify();


        this.set('slug', slug);

        return this.verifySlug();
    }
}, {});
// Concat source to main.js with 'cat source/*.js > cloud/main.js'

var _ = require("underscore"),
    moment = require('cloud/moment-timezone-with-data.js'),
    mandrillKey = 'zAg8HDZtlJSoDu-ozHA3HQ',
    Mandrill = require('mandrill'),
    Stripe = require('stripe');

Mandrill.initialize(mandrillKey);

Stripe.initialize('sk_test_AfBhaEg8Yojoc1hylUI0pdtc'); // testing key
//Stripe.initialize('sk_live_AbPy747DUMLo8qr53u5REcaX'); // live key

var APP = {
    baseUrl: 'https://synap.mycqs.com/',
    baseCDN: 'https://d3uzzgmigql815.cloudfront.net/'
};
var FB = {
    API: {
        url: 'https://graph.facebook.com/v2.3/me/'
    },
    GraphObject: {
        appId: "394753023893264",
        namespace: "mycqs_app",
        testUrl: APP.baseUrl + "test/"
    }
};/*
 * HELPER CLASSES
 */

/**
 * @Function Slugify
 * Lower cases, replaces spaces with -
 * @returns {string}
 */
String.prototype.slugify = function () {
    return this.replace(/ /g, '-').replace(/[-]+/g, '-').replace(/[^\w-]+/g, '').toLowerCase();
};/*
 * BACKGROUND JOBS
 */
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

    if (!promises.length)
        return response.success();

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
});


/**
 * @beforeSave Test
 *
 * New test:
 * - Set default parameters
 * - Generate slug (async)
 *
 */
Parse.Cloud.beforeSave(Test, function (request, response) {
    var test = request.object,
        user = request.user,
        promises = [];

    if (test.isNew()) {
        test.setDefaults();

        if(!test.isGenerated() && test.title() && user)
            promises.push(test.generateSlug(user.get('slug')));
    }

    if (!promises.length)
        return response.success();

    Parse.Promise.when(promises).then(function () {
        response.success();
    }, function (error) {
        response.error(error);
    });
});/*
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
        latestAttempts,
        messages,
        followers,
        following,
        groups,
        attempts,
        activities,
        promises = [];

    promises.push(config = Parse.Config.get());
    promises.push(categories = new Parse.Query("Category").include("parent").find());
    if (user) {
        var testsQuery = new Parse.Query("Test");
        testsQuery.equalTo('author', user);
        testsQuery.notEqualTo('isObjectDeleted', true);
        testsQuery.notEqualTo('isSpacedRepetition', true);
        testsQuery.ascending('title');
        promises.push(tests = testsQuery.find());

        var messagesQuery = new Parse.Query("Message");
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
        promises.push(groups = groupsQuery.find());
    }
    Parse.Promise.when(promises).then(function () {
        var result = {
            config: config,
            categories: categories["_result"][0]
        };
        if (tests)
            result.tests = tests["_result"][0];
        if (messages)
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
        }
        return response.success(result);
    }, function (error) {
        return response.error(error);
    });
});