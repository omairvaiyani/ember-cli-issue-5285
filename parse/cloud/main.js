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
     * Runs the generateTags function.
     * @returns {Test}
     */
    setDefaults: function () {
        var numberProps = ["quality", "averageScore",
            "averageUniqueScore", "numberOfAttempts", "numberOfUniqueAttempts"];

        _.each(numberProps, function (prop) {
            this.set(prop, 0);
        }.bind(this));

        if (!this.get('questions'))
            this.set('questions', []);

        if (this.author()) {
            var ACL = new Parse.ACL(this.author());
            if (this.privacy() === 1)
                ACL.setPublicReadAccess(true);
            this.setACL(ACL);
        }

        this.generateTags();

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
    },

    /**
     * @Function Generate Tags
     * Creates an array of tags based on
     * title
     * @returns {Test}
     */
    generateTags: function () {
        if (!this.title())
            return this;
        var rawTags = this.title().toLowerCase().split(" "),
            tags = [];
        _.each(rawTags, function (tag) {
            if (tag.length)
                tags.push(tag);
        });

        this.set('tags', tags);
        return this;
    }
}, {});

/****
 * --------
 * Question
 * --------
 *
 **/
var Question = Parse.Object.extend("Question", {
    /**
     * @Property stem
     * @returns {string}
     */
    stem: function () {
        return this.get('stem');
    },

    /**
     * @Property feedback
     * @returns {string}
     */
    feedback: function () {
        return this.get('feedback');
    },

    /**
     * @Property numberOfResponses
     * @returns {integer}
     */
    numberOfResponses: function () {
        return this.get('numberOfResponses');
    },

    /**
     * @Property numberOfCorrectResponses
     * @returns {integer}
     */
    numberOfCorrectResponses: function () {
        return this.get('numberOfCorrectResponses');
    },

    /**
     * @Function Set Defaults
     * Adds 0, booleans and empty arrays to
     * default properties. This reduces
     * errors further down the line.
     *
     * ACL
     * {user: read/write, public: read}
     * @param {Parse.User} user
     * @returns {Question}
     */
    setDefaults: function (user) {
        var numberProps = ["numberOfResponses", "numberOfCorrectResponses"];

        _.each(numberProps, function (prop) {
            this.set(prop, 0);
        }.bind(this));

        if (user) {
            var ACL = new Parse.ACL(user);
            // TODO A way to check test.privacy
            ACL.setPublicReadAccess(true);
            this.setACL(ACL);
        }

        this.generateTags();
        return this;
    },

    /**
     * @Function Generate Tags
     * Creates an array of tags based on
     * title and feedback.
     * @returns {Question}
     */
    generateTags: function () {
        if (!this.stem())
            return this;

        var rawTags = this.stem(),
            tags;

        if(this.feedback())
           rawTags += " " + this.feedback();

        tags = rawTags.removeStopWords().toLowerCase().split(" ");

        this.set('tags', tags);
        return this;
    }
}, {});

/****
 * -------
 * Attempt
 * -------
 *
 **/
var Attempt = Parse.Object.extend("Attempt", {
    /**
     * @Property user
     * @returns {Parse.User}
     */
    user: function () {
        return this.get('user');
    },

    /**
     * @Property test
     * @returns {Test}
     */
    test: function () {
        return this.get('test');
    },

    /**
     * @Property score
     * @returns {integer}
     */
    score: function () {
        return this.get('score');
    },

    /**
     * @Property isSpacedRepetition
     * @returns {boolean}
     */
    isSpacedRepetition: function () {
        return this.get('isSpacedRepetition');
    },

    /**
     * @Property timeStarted
     * @returns {Date}
     */
    timeStarted: function () {
        return this.get('timeStarted');
    },

    /**
     * @Property timeCompleted
     * @returns {Date}
     */
    timeCompleted: function () {
        return this.get('timeCompleted');
    },

    /**
     * @Property timeTaken
     * @returns {Integer} 'seconds'
     */
    timeTaken: function () {
        return this.get('timeTaken');
    },

    /**
     * @Function Set Defaults
     * Sets timeTaken in seconds
     * to complete attempt.
     *
     * ACL if user:
     * {user: read}
     * else
     * {public: read}
     *
     * @returns {Attempt}
     */
    setDefaults: function () {
        var timeTaken = moment(this.timeCompleted()).diff(moment(this.timeStarted()), 'second');
        this.set('timeTaken', timeTaken);

        var ACL = new Parse.ACL();
        if(this.user()) {
            ACL.setReadAccess(this.user(), true);
        } else {
            ACL.setPublicReadAccess(true);
        }
        this.setACL(ACL);

        return this;
    }
}, {});

/****
 * -------
 * Response
 * -------
 *
 **/
var Response = Parse.Object.extend("Response", {
    /**
     * @Property user
     * @returns {Parse.User}
     */
    user: function () {
        return this.get('user');
    },

    /**
     * @Property test
     * @returns {Test}
     */
    test: function () {
        return this.get('test');
    },

    /**
     * @Property question
     * @returns {Question}
     */
    question: function () {
        return this.get('question');
    },

    /**
     * @Property isCorrect
     * @returns {boolean}
     */
    isCorrect: function () {
        return this.get('isCorrect');
    },

    /**
     * @Property chosenOptions
     * @returns {Array}
     */
    chosenOptions: function () {
        return this.get('chosenOptions');
    },

    /**
     * @Property correctOptions
     * @returns {Array}
     */
    correctOptions: function () {
        return this.get('correctOptions');
    },

    /**
     * @Function Set Defaults
     * ACL if user:
     * {user: read}
     * else
     * {public: read}
     *
     * @returns {Response}
     */
    setDefaults: function () {
        var ACL = new Parse.ACL();
        if(this.user()) {
            ACL.setReadAccess(this.user(), true);
        } else {
            ACL.setPublicReadAccess(true);
        }
        this.setACL(ACL);

        return this;
    }
}, {});// Concat source to main.js with 'cat source/*.js > cloud/main.js'

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
};
/**
 * @Function Remove Stop Words
 * Cleanses a phrase by removing
 * 'stop words'. Useful for
 * indexing with tags.
 * @returns {string}
 */
String.prototype.removeStopWords = function () {
    var x, y, word, stop_word, regex_str,
        regex, cleansed_string = this.valueOf(),
        // Split out all the individual words in the phrase
        words = cleansed_string.match(/[^\s]+|\s+[^\s+]$/g),
        stopWords = require("cloud/stop-words.js").english;

    // Review all the words
    for (x = 0; x < words.length; x++) {
        // For each word, check all the stop words
        for (y = 0; y < stopWords.length; y++) {
            // Get the current word
            word = words[x].replace(/\s+|[^a-z]+/ig, "");   // Trim the word and remove non-alpha

            // Get the stop word
            stop_word = stopWords[y];

            // If the word matches the stop word, remove it from the keywords
            if (word.toLowerCase() == stop_word) {
                // Build the regex
                regex_str = "^\\s*" + stop_word + "\\s*$";      // Only word
                regex_str += "|^\\s*" + stop_word + "\\s+";     // First word
                regex_str += "|\\s+" + stop_word + "\\s*$";     // Last word
                regex_str += "|\\s+" + stop_word + "\\s+";      // Word somewhere in the middle
                regex = new RegExp(regex_str, "ig");

                // Remove the word from the keywords
                cleansed_string = cleansed_string.replace(regex, " ");
            }
        }
    }
    return cleansed_string.replace(/^\s+|\s+$/g, "");
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

        if(!test.isGenerated() && test.title() && user)
            promises.push(test.generateSlug(user));
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

    if (!promises.length)
        return response.success();

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
        user = request.user,
        promises = [];

    if (attempt.isNew()) {
        attempt.setDefaults();
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
 * @beforeSave Response
 *
 * New Response:
 * - Set default parameters + ACL
 *
 */
Parse.Cloud.beforeSave(Response, function (request, response) {
    var responseObject = request.object,
        user = request.user,
        promises = [];

    if (responseObject.isNew()) {
        responseObject.setDefaults();
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
        promises = [];

    promises.push(config = Parse.Config.get());
    promises.push(categories = new Parse.Query("Category").include("parent").find());
    /*if (user) {
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
    }*/
    Parse.Promise.when(promises).then(function () {
        var result = {
            config: config,
            categories: categories["_result"][0]
        };
        /*if (tests)
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
        }*/
        return response.success(result);
    }, function (error) {
        return response.error(error);
    });
});