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
}, {});