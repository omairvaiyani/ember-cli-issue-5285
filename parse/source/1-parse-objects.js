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
/**
 * @Function Generate Pointer
 * @param {string} className
 * @param {string} objectId
 * @returns {{__type: string, className: {string}, objectId: {string}}
 */
Parse.Object.generatePointer = function (className, objectId) {
    return {"__type": "Pointer", "className": className, "objectId": objectId};
};
/**
 * @Function Generate Pointers
 * @param {string} className
 * @param {Array<String>} objectIds
 * @returns {Array}
 */
Parse.Object.generatePointers = function (className, objectIds) {
    var pointers = [];
    if (!objectIds || !objectIds.length)
        return pointers;
    else {
        _.each(objectIds, function (objectId) {
            pointers.push(Parse.Object.generatePointer(className, objectId));
        });
    }
    return pointers;
};
/**
 * @Function Create from JSON
 * Convert payloads to parse objects.
 * Ambiguous to any class.
 * Can take single object or array of
 * objects. NOTE: the payload must
 * contain className!
 * @param {Object} payload
 * @param {string} className
 * @returns {*}
 */
Parse.Object.createFromJSON = function (payload, className) {
    var isSingleObject = false,
        parseObjects = [];
    if (payload.constructor !== Array) {
        payload = [payload];
        isSingleObject = true;
    }
    _.each(payload, function (object) {
        var parseObject = new Parse.Object(className);
        _.each(_.pairs(object), function (pair) {
            var key = pair[0], value = pair[1];
            if (_.contains(parseObject.getPointerFields(), key))
                parseObject["set" + key.capitalizeFirstLetter()](value);
            else
                parseObject.set(key, value);
        });
        parseObjects.push(parseObject);
    });
    if (isSingleObject)
        return parseObjects[0];
    else
        return parseObjects;
};
/**
 * @Function Fetch If Needed
 * Checks if object is a pointer
 * or fetched already. Returns
 * a promise that either resolves
 * straightaway or actually fetches
 * the pointer.
 * @returns {Parse.Promise<Parse.Object>}
 */
Parse.Object.prototype.fetchIfNeeded = function () {
    // This is a good, but not foolproof, way to check
    // if the object is fetched or not.
    if (!this.createdAt) {
        // This works.
        return this.fetch();
    } else {
        // This hasn't been tested yet
        // Might not work?
        return Parse.Promise.as(this);
    }
};
/****
 * ----------
 * Parse.User
 * ----------
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
/**
 * @Function Check Level Up
 * @return {Parse.Promise<boolean>} didLevelUp
 */
Parse.User.prototype.checkLevelUp = function () {
    var currentLevel = this.level(),
        promise;

    // User has no level set: this shouldn't happen
    // *once* we set Level 1 by default on sign up.
    if (!currentLevel) {
        var query = new Parse.Query(Level);
        query.equalTo('number', 1);
        promise = query.find().then(function (result) {
            this.set('level', result[0]);
            return this.save();
        }.bind(this)).then(function () {
            return Parse.Promise.as(true);
        });
    } else {
        // User has a level set, fetch and check
        // if the user should level up
        promise = currentLevel.fetchIfNeeded().then(function (a) {
            if (this.points() < (currentLevel.pointsRequired() + currentLevel.pointsToLevelUp()))
                return Parse.Promise.as(false);
            else {
                return Level.getNextLevel(currentLevel).then(function (nextLevel) {
                    this.set('level', nextLevel);
                    return this.save();
                }.bind(this)).then(function () {
                    return Parse.Promise.as(true);
                });
            }
        }.bind(this));
    }
    return promise;
};
/**
 * @Function Add Unique Responses
 *
 * Called after a user finishes an attempt.
 * All relevant unique responses are queries
 * from the uniqueResponses relation.
 *
 * Existing uniqueResponses are incremented,
 * and non-existent are created and saved.
 *
 * @params {Array<Response>} responses
 * @return {Parse.Promise<Array<UniqueResponse>>} uniqueResponses
 */
Parse.User.prototype.addUniqueResponses = function (responses) {
    var uniqueResponsesQuery = this.uniqueResponses().query(),
        questions = [];

    _.each(responses, function (response) {
        var question = response.question();
        questions.push(question);
        //promises.push(question.fetchIfNeeded());
    });
    uniqueResponsesQuery.containedIn('question', questions);
    return uniqueResponsesQuery.find().then(function (uniqueResponses) {
        // uniqueResponsesToSave allows us to mix old and new uniqueResponses
        // whilst keeping the old uniqueResponses reference:
        // This is needed for _.find() within the _.each loop.
        var uniqueResponsesToSave = [];

        _.each(responses, function (response) {
            var uniqueResponse = _.find(uniqueResponses, function (uniqueResponse) {
                return uniqueResponse.question().id === response.question().id;
            });
            if (!uniqueResponse) {
                uniqueResponse = UniqueResponse.initialize(response, this);
            } else {
                uniqueResponse.addLatestResponse(response);
            }
            uniqueResponsesToSave.push(uniqueResponse);
        }.bind(this));

        // Cannot edit UniqueResponses without this.
        Parse.Cloud.useMasterKey();

        return Parse.Object.saveAll(uniqueResponsesToSave);
    }.bind(this)).then(function (uniqueResponses) {
        this.uniqueResponses().add(uniqueResponses);
        this.save();
        return Parse.Promise.as(uniqueResponses);
    }.bind(this));
};
/**
 * @Property name
 * @returns {string}
 */
Parse.User.prototype.name = function () {
    return this.get('name');
};
/**
 * @Property createdTests
 * @returns {Parse.Relation}
 */
Parse.User.prototype.createdTests = function () {
    return this.relation('createdTests');
};
/**
 * @Property userEvents
 * @returns {Parse.Relation}
 */
Parse.User.prototype.userEvents = function () {
    return this.relation('userEvents');
};
/**
 * @Property level
 * @returns {Level}
 */
Parse.User.prototype.level = function () {
    return this.get('level');
};
/**
 * @Property points
 * @returns {integer}
 */
Parse.User.prototype.points = function () {
    return this.get('points');
};
/**
 * @Property uniqueResponses
 * @returns {Parse.Relation<UniqueResponse>}
 */
Parse.User.prototype.uniqueResponses = function () {
    return this.relation('uniqueResponses');
};
/****
 * ---------
 * UserEvent
 * ---------
 *
 **/
var UserEvent = Parse.Object.extend("UserEvent", {
    /**
     * @Property type
     * @returns {string}
     */
    type: function () {
        return this.get('type');
    },

    /**
     * @Property pointsTransacted
     * @returns {string}
     */
    pointsTransacted: function () {
        return this.get('pointsTransacted');
    },

    /**
     * @Property objects
     * Ambiguous Parse pointers
     * @returns {Array}
     */
    objects: function () {
        return this.get('objects');
    },

    /**
     * @Property objectTypes
     * Class names for the objects
     * @returns {Array}
     */
    objectTypes: function () {
        return this.get('objectTypes');
    },

    /**
     * @Function Assign Points
     * Async method to assign points
     * to a given userEvent based on
     * the Parse.Config parameters.
     * @returns {Parse.Promise<UserEvent>}
     */
    assignPoints: function () {
        return Parse.Config.get().then(function (config) {
            var pointsToAssign = _.find(config.get('userEvents'), function (userEvent) {
                return userEvent.type === this.type();
            }.bind(this));
            this.set('pointsTransacted', pointsToAssign.reward);
            return Parse.Promise.as(this);
        }.bind(this));
    },

    /**
     * @Function Set Defaults
     * ACL
     * {user: read}
     *
     * @param {Parse.User} user
     * @returns {UserEvent}
     */
    setDefaults: function (user) {
        if (user) {
            var ACL = new Parse.ACL();
            ACL.setReadAccess(user, true);
            this.setACL(ACL);
        }
        return this;
    }
}, {
    CREATED_TEST: "createdTest",

    /**
     * @Deprecated
     * @Function Created Test
     * Sets the userEvent type,
     * objects, objectTypes and
     * finally, the pointsTransacted
     * by calling the async method,
     * assignPoints.
     *
     * @param {Test} test
     * @param {Parse.User} user
     * @returns {Parse.Promise<UserEvent>}
     */
    createdTest: function (test, user) {
        var userEvent = new UserEvent();
        userEvent.set('type', UserEvent.CREATED_TEST);
        userEvent.set('objects', [test]);
        userEvent.set('objectTypes', [test.className]);
        userEvent.setDefaults(user);
        return userEvent.assignPoints().then(function () {
            return userEvent.save();
        }).then(function () {
            // Increment user.points
            user.increment('points', userEvent.pointsTransacted());
            // Add userEvent to user.userEvents relation
            var userEvents = user.userEvents();
            userEvents.add(userEvent);
            return user.save();
        }).then(function () {
            return Parse.Promise.as(userEvent);
        });
    },

    /**
     * @Function New Event
     *
     * Sets the event type, objects,
     * assigns points (async) and
     * finally adds the event to
     * the user.userEvents relation.
     *
     * Note: assignPoints() is a function
     * to determine how many points the
     * event is worth based on Parse.Config.
     * After this function is called, we can
     * increment the user points in this
     * method.
     *
     * @param {string} eventType
     * @param {*} objects
     * @param {Parse.User} user
     * @returns {Parse.Promise} userEvent
     */
    newEvent: function (eventType, objects, user) {
        var userEvent = new UserEvent();
        userEvent.set('type', eventType);
        if (objects.constructor !== Array)
            objects = [objects];
        userEvent.set('objects', objects);
        var objectTypes = _.map(objects, function (object) {
            return object.className;
        });
        userEvent.set('objectTypes', objectTypes);
        userEvent.setDefaults(user);

        return userEvent.assignPoints().then(function () {
            return userEvent.save();
        }).then(function () {
            user.increment('points', userEvent.pointsTransacted());
            var userEvents = user.userEvents();
            userEvents.add(userEvent);
            return user.save();
        }).then(function () {
            return Parse.Promise.as(userEvent);
        });
    }
});

/****
 * --------
 * Category
 * --------
 *
 **/
var Category = Parse.Object.extend("Category", {
    /**
     * @Property parent
     * @returns {Category}
     */
    parent: function () {
        return this.get('parent');
    },

    /**
     * @Property name
     * @returns {string}
     */
    name: function () {
        return this.get('name');
    },

    /**
     * @Property hasChildren
     * @returns {boolean}
     */
    hasChildren: function () {
        return this.get('hasChildren');
    }
}, {});

/****
 * ----
 * Test
 * ----
 *
 **/
var Test = Parse.Object.extend("Test", {
    /**
     * @Function Get Pointer Fields
     * Allows ambiguous functions
     * to create instances from payload
     * data and differentiate between
     * direct fields and embedded
     * fields. Use case:
     * Parse.Object.createFromJSON.
     * @returns {string[]}
     */
    getPointerFields: function () {
        return ['author', 'category'];
    },
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
     * @Function Set Author
     * @param {Parse.User} author
     * @returns {Test}
     */
    setAuthor: function (author) {
        if (typeof author === 'string') {
            this.set('author', Parse.Object.generatePointer("_User", author));
        } else
            this.set('author', author);
        return this;
    },

    /**
     * @Property category
     * @returns {Category}
     */
    category: function () {
        return this.get('category');
    },

    /**
     * @Function Set Category
     * @param {Category} category
     * @returns {Test}
     */
    setCategory: function (category) {
        if (typeof category === 'string') {
            this.set('category', Parse.Object.generatePointer("Category", category));
        } else
            this.set('category', category);
        return this;
    },

    /**
     * @Property isPublic
     * @returns {boolean}
     */
    isPublic: function () {
        return this.get('isPublic');
    },

    /**
     * @Property isGenerated
     * @returns {boolean}
     */
    isGenerated: function () {
        return this.get('isGenerated');
    },

    /**
     * @Property questions
     * @return {Parse.Collection}
     */
    questions: function () {
        return this.get('questions');
    },

    /**
     * @Property slug
     * @return {string}
     */
    slug: function () {
        return this.get('slug');
    },

    /**
     * @Function Set Defaults
     * Adds 0, booleans and empty arrays to
     * default properties. This reduces
     * errors further down the line.
     *
     * ACL
     * If isPublic
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

        var boolProps = ["isGenerated", "isObjectDeleted",
            "isProfessional", "isSpacedRepetition"];

        _.each(boolProps, function (prop) {
            if (!this.get(prop))
                this.set(prop, false);
        }.bind(this));

        if (!this.get('questions'))
            this.set('questions', []);

        if (this.author()) {
            var ACL = new Parse.ACL(this.author());
            ACL.setPublicReadAccess(this.isPublic());
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
     * @Property options
     * @returns {Array}
     */
    options: function () {
        return this.get('options');
    },

    /**
     * @Property isPublic
     * @returns {boolean}
     */
    isPublic: function () {
        return this.get('isPublic');
    },

    /**
     * @Function Set Defaults
     * Adds 0, booleans and empty arrays to
     * default properties. This reduces
     * errors further down the line.
     *
     * ACL publicReadAccess depends
     * on the Test that this question
     * belongs to. Therefore, Question.isPublic
     * should correlated to and be changed
     * whenever Test.isPublic changes.
     *
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
            ACL.setPublicReadAccess(this.isPublic());
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

        if (this.feedback())
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
     * @Function Get Pointer Fields
     * Allows ambiguous functions
     * to create instances from payload
     * data and differentiate between
     * direct fields and embedded
     * fields. Use case:
     * Parse.Object.createFromJSON.
     * @returns {string[]}
     */
    getPointerFields: function () {
        return ['questions', 'test', 'responses', 'user'];
    },

    /**
     * @Property user
     * @returns {Parse.User}
     */
    user: function () {
        return this.get('user');
    },

    /**
     * @Function Set User
     * @param {Parse.User} user
     * @returns {Attempt}
     */
    setUser: function (user) {
        if (typeof user === 'string') {
            this.set('user', Parse.Object.generatePointer("_User", user));
        } else
            this.set('user', user);
        return this;
    },

    /**
     * @Property test
     * @returns {Test}
     */
    test: function () {
        return this.get('test');
    },

    /**
     * @Function Set Test
     * @param {Test} test
     * @returns {Attempt}
     */
    setTest: function (test) {
        if (typeof test === 'string') {
            this.set('test', Parse.Object.generatePointer("Test", test));
        } else
            this.set('test', test);
        return this;
    },

    /**
     * @Property responses
     * @returns {Array<Response>}
     */
    responses: function () {
        return this.get('responses');
    },

    /**
     * @Function Set Responses
     * @param {Array<Response>} responses
     * @returns {Attempt}
     */
    setResponses: function (responses) {
        if (!responses || responses.constructor !== Array)
            return this;
        if (responses[0] === String) {
            this.set('responses', Parse.Object.generatePointers("Response", responses));
        } else
            this.set('responses', responses);
        return this;
    },

    /**
     * @Property questions
     * @returns {Array<Question>}
     */
    questions: function () {
        return this.get('questions');
    },

    /**
     * @Function Set Questions
     * @param {Array<Question>} questions
     * @returns {Attempt}
     */
    setQuestions: function (questions) {
        if (!questions || questions.constructor !== Array)
            return this;
        if (questions[0].constructor === String) {
            this.set('questions', Parse.Object.generatePointers("Question", questions));
        } else
            this.set('questions', questions);
        return this;
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
        if (this.user()) {
            ACL.setReadAccess(this.user(), true);
        } else {
            ACL.setPublicReadAccess(true);
        }
        this.setACL(ACL);

        return this;
    }
}, {});

/****
 * --------
 * Response
 * --------
 *
 **/
var Response = Parse.Object.extend("Response", {
    /**
     * @Function Get Pointer Fields
     * Allows ambiguous functions
     * to create instances from payload
     * data and differentiate between
     * direct fields and embedded
     * fields. Use case:
     * Parse.Object.createFromJSON.
     * @returns {string[]}
     */
    getPointerFields: function () {
        return ['user', 'test', 'question', ''];
    },
    /**
     * @Property user
     * @returns {Parse.User}
     */
    user: function () {
        return this.get('user');
    },

    /**
     * @Function Set User
     * @param {Parse.User} user
     * @returns {Response}
     */
    setUser: function (user) {
        if (typeof user === 'string') {
            this.set('user', Parse.Object.generatePointer("_User", user));
        } else
            this.set('user', user);
        return this;
    },


    /**
     * @Property test
     * @returns {Test}
     */
    test: function () {
        return this.get('test');
    },

    /**
     * @Function Set Test
     * @param {Test} test
     * @returns {Response}
     */
    setTest: function (test) {
        if (typeof test === 'string') {
            this.set('test', Parse.Object.generatePointer("Test", test));
        } else
            this.set('test', test);
        return this;
    },

    /**
     * @Property question
     * @returns {Question}
     */
    question: function () {
        return this.get('question');
    },

    /**
     * @Function Set Question
     * @param {Question} question
     * @returns {Response}
     */
    setQuestion: function (question) {
        if (typeof question === 'string') {
            this.set('question', Parse.Object.generatePointer("Question", question));
        } else
            this.set('question', question);
        return this;
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
        if (this.user()) {
            ACL.setReadAccess(this.user(), true);
        } else {
            ACL.setPublicReadAccess(true);
        }
        this.setACL(ACL);

        return this;
    }
}, {});

/****
 * --------------
 * UniqueResponse
 * --------------
 *
 **/
var UniqueResponse = Parse.Object.extend("UniqueResponse", {
    /**
     * @Function Get Pointer Fields
     * @returns {string[]}
     */
    getPointerFields: function () {
        return ['latestResponse', 'test', 'question'];
    },
    /**
     * @Property test
     * @returns {Test}
     */
    test: function () {
        return this.get('test');
    },

    /**
     * @Function Set Test
     * @param {Test} test
     * @returns {UniqueResponse}
     */
    setTest: function (test) {
        if (typeof test === 'string') {
            this.set('test', Parse.Object.generatePointer("Test", test));
        } else
            this.set('test', test);
        return this;
    },

    /**
     * @Property question
     * @returns {Question}
     */
    question: function () {
        return this.get('question');
    },

    /**
     * @Function Set Question
     * @param {Question} question
     * @returns {UniqueResponse}
     */
    setQuestion: function (question) {
        if (typeof question === 'string') {
            this.set('question', Parse.Object.generatePointer("Question", question));
        } else
            this.set('question', question);
        return this;
    },

    /**
     * @Property latestResponse
     * @returns {Response}
     */
    latestResponse: function () {
        return this.get('latestResponse');
    },

    /**
     * @Function Set Latest Response
     * @param {Response} response
     * @returns {UniqueResponse}
     */
    setLatestResponse: function (response) {
        if (typeof response === 'string') {
            this.set('latestResponse', Parse.Object.generatePointer("Response", response));
        } else
            this.set('latestResponse', response);
        return this;
    },

    /**
     * @Property responses
     * @returns {Parse.Relation<Response>}
     */
    responses: function () {
        return this.relation('responses');
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
     * @Property latestResponseIsCorrect
     * @returns {boolean}
     */
    latestResponseIsCorrect: function () {
        return this.get('latestResponseIsCorrect');
    },

    /**
     * @Property latestResponseDate
     * @returns {Date}
     */
    latestResponseDate: function () {
        return this.get('latestResponseDate');
    },


    /**
     * @Function Set Defaults
     * ACL if user:
     * {user: read}
     * else
     * {public: read}
     * @params {Parse.User} user
     * @returns {UniqueResponse}
     */
    setDefaults: function (user) {
        var ACL = new Parse.ACL();
        if (user) {
            ACL.setReadAccess(user, true);
        } else {
            ACL.setPublicReadAccess(true);
        }
        this.setACL(ACL);

        return this;
    },

    /**
     * @Function Add Latest Response
     * For existent uniqueResponses where
     * the user has retaken the same
     * question.
     *
     * Current use case, called from
     * Parse.User.addUniqueResponses()
     *
     * @param {Response} response
     * @return {UniqueResponse}
     */
    addLatestResponse: function (response) {
        this.setLatestResponse(response);
        this.set('latestResponseIsCorrect', response.isCorrect());
        this.set('latestResponseDate', response.createdAt ? response.createdAt : new Date());
        this.increment('numberOfResponses');
        if (response.isCorrect())
            this.increment('numberOfCorrectResponses');
        this.responses().add(response);
        return this;
    }
}, {
    /**
     * @Function Initialize
     *
     * Current use case, called from
     * Parse.User.addUniqueResponses()
     *
     * @param {Response} response
     * @param {Parse.User} user
     * @return {UniqueResponse}
     */
    initialize: function (response, user) {
        var uniqueResponse = new UniqueResponse();
        uniqueResponse.setQuestion(response.question());
        uniqueResponse.setTest(response.test());
        uniqueResponse.setLatestResponse(response);
        uniqueResponse.set('latestResponseIsCorrect', response.isCorrect());
        uniqueResponse.set('latestResponseDate', response.createdAt ? response.createdAt : new Date());
        uniqueResponse.set('numberOfResponses', 1);
        uniqueResponse.set('numberOfCorrectResponses', response.isCorrect() ? 1 : 0);
        uniqueResponse.responses().add(response);
        uniqueResponse.setDefaults(user);
        return uniqueResponse;
    }
});

/****
 * -----
 * Level
 * -----
 *
 **/
var Level = Parse.Object.extend("Level", {
    /**
     * @Property number
     * @returns {integer}
     */
    number: function () {
        return this.get('number');
    },

    /**
     * @Property title
     * @returns {string}
     */
    title: function () {
        return this.get('title');
    },

    /**
     * @Property pointsRequired
     * @returns {number}
     */
    pointsRequired: function () {
        return this.get('pointsRequired');
    },


    /**
     * @Property pointsToLevelUp
     * @returns {number}
     */
    pointsToLevelUp: function () {
        return this.get('pointsToLevelUp');
    }
}, {
    /**
     * @Function Get Next Level
     * Fetches the next level up.
     * @param {Level} level
     * @return {Parse.Promise<Level>}
     */
    getNextLevel: function (level) {
        var query = new Parse.Query(Level);
        query.equalTo('number', (level.number() + 1));
        return query.find().then(function (result) {
            return Parse.Promise.as(result[0]);
        });
    }
});