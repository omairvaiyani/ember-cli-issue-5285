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
        if(object.id)
            parseObject.id = object.id;
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
 * @Function FetchEducationCohort
 * This allows us to fetch the user's educationCohort
 * *as well as* the studyField and institution.
 * @return {Parse.Promise<EducationCohort>} educationCohort
 */
Parse.User.prototype.fetchEducationCohort = function () {
    var educationCohort = this.educationCohort();

    // User has no level set: this shouldn't happen
    // *once* we set Level 1 by default on sign up.
    if (educationCohort) {
        var promise = educationCohort.fetch().then(function () {
            var promises = [];
            if(educationCohort.studyField())
                promises.push(educationCohort.studyField().fetch());
            if(educationCohort.institution())
                promises.push(educationCohort.institution().fetch());
            return Parse.Promise.when(promises);
        }.bind(this)).then(function () {
            return Parse.Promise.as(educationCohort);
        });
        return promise;
    } else
       return Parse.Promise.as(null);
};
/**
 * @Function Fetch SR Latest Test
 * This allows us to fetch the user's srLatestTest
 * *as well as* the questions within it
 * @return {Parse.Promise<Test>} srLatestTest
 */
Parse.User.prototype.fetchSRLatestTest = function () {
    var srLatestTest = this.srLatestTest();
    // User has no level set: this shouldn't happen
    // *once* we set Level 1 by default on sign up.
    if (srLatestTest) {
        var query = new Parse.Query(Test);
        query.include('questions');
        return query.get(srLatestTest.id);
    } else
        Parse.Promise.resolve(null);
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
/**
 * @Property educationCohort
 * @returns {EducationCohort}
 */
Parse.User.prototype.educationCohort = function () {
    return this.get('educationCohort');
};
/**
 * @Property srLatestTest
 * @returns {Test}
 */
Parse.User.prototype.srLatestTest = function () {
    return this.get('srLatestTest');
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
    ADDED_QUESTION: "addedQuestion",

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

        if(!this.get('tags') || !this.get('tags').length)
            this.set('tags', []);

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
        return [];
    },
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

        if(this.isPublic() !== false && this.isPublic() !== true)
            this.set('isPublic', true);

        if (user) {
            var ACL = new Parse.ACL(user);
            ACL.setPublicReadAccess(this.isPublic());
            this.setACL(ACL);
        }

        if(!this.get('tags') || !this.get('tags').length)
            this.set('tags', []);
        return this;
    },

    /**
     * @Function Generate Tags
     * @Deprecated
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
     * @Property memoryStrength
     * @returns {number}
     */
    memoryStrength: function () {
        return this.get('memoryStrength');
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
        this.updateMemoryStrength();
        this.responses().add(response);
        return this;
    },

    /**
     * @Function Update Memory Strength
     * @returns {UniqueResponse}
     */
    updateMemoryStrength: function () {
        var decayMultiplier = 6 - this.numberOfCorrectResponses();
        if (decayMultiplier < 1)
            decayMultiplier = 1;

        var hoursSinceLatestResponse = moment().diff(this.latestResponseDate(), 'hours');

        var memoryStrength = (100 - ((hoursSinceLatestResponse / 10 ) * decayMultiplier) ) +
            ( (hoursSinceLatestResponse / 100) ^ 2 );

        if (!this.latestResponseIsCorrect())
            memoryStrength = memoryStrength - 30;

        if (memoryStrength < 0)
            memoryStrength = 0;
        else if (memoryStrength > 100)
            memoryStrength = 100;

        this.set('memoryStrength', Math.round(memoryStrength));
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
        uniqueResponse.updateMemoryStrength();
        uniqueResponse.responses().add(response);
        uniqueResponse.setDefaults(user);
        return uniqueResponse;
    },

    /**
     * @Function Find With Updated Memory Strengths
     * @param {Parse.Query<UniqueResponse>} query
     * @returns {Parse.Promise<Array<UniqueResponse>>}
     */
    findWithUpdatedMemoryStrengths: function (query) {
        return query.find().then(function (uniqueResponses) {
           return UniqueResponse.updateMemoryStrength(uniqueResponses);
        });
    },

    /**
     * @Function Update Memory Strength
     * @param {Array<UniqueResponse>} uniqueResponses
     * @return {Parse.Promise<Array<UniqueResponse>>}
     */
    updateMemoryStrength: function (uniqueResponses) {
        _.each(uniqueResponses, function (uniqueResponse) {
            uniqueResponse.updateMemoryStrength();
        });
        return Parse.Object.saveAll(uniqueResponses);
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

/****
 * -----
 * EducationCohort
 * -----
 *
 **/
var EducationCohort = Parse.Object.extend("EducationCohort", {
    /**
     * @Property currentYear
     * @returns {String}
     */
    currentYear: function () {
        return this.get('currentYear');
    },

    /**
     * @Property graduationYear
     * @returns {number}
     */
    graduationYear: function () {
        return this.get('graduationYear');
    },

    /**
     * @Property institution
     * @returns {Institution}
     */
    institution: function () {
        return this.get('institution');
    },


    /**
     * @Property studyField
     * @returns {StudyField}
     */
    studyField: function () {
        return this.get('studyField');
    }
}, {

});
/****
 * -----
 * Institution
 * -----
 *
 **/
var Institution = Parse.Object.extend("Institution", {
    /**
     * @Property name
     * @returns {String}
     */
    name: function () {
        return this.get('name');
    },

    /**
     * @Property type
     * @returns {String}
     */
    type: function () {
        return this.get('type');
    },

    /**
     * @Property facebookId
     * @returns {String}
     */
    facebookId: function () {
        return this.get('facebookId');
    },

    /**
     * @Property fbObject
     * @returns {Object}
     */
    fbObject: function () {
        return this.get('fbObject');
    },

    /**
     * @Property pictureUrl
     * @returns {String}
     */
    pictureUrl: function () {
        return this.get('pictureURl');
    },


    /**
     * @Property cover
     * @returns {Object}
     */
    cover: function () {
        return this.get('cover');
    }
}, {

});

/****
 * -----
 * StudyField
 * -----
 *
 **/
var StudyField = Parse.Object.extend("StudyField", {
    /**
     * @Property name
     * @returns {String}
     */
    name: function () {
        return this.get('name');
    },

    /**
     * @Property facebookId
     * @returns {String}
     */
    facebookId: function () {
        return this.get('facebookId');
    },

    /**
     * @Property fbObject
     * @returns {Object}
     */
    fbObject: function () {
        return this.get('fbObject');
    },

    /**
     * @Property pictureUrl
     * @returns {String}
     */
    pictureUrl: function () {
        return this.get('pictureURl');
    }
}, {

});// Concat source to main.js with 'cat source/*.js > cloud/main.js'

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
 * @Function Capitalize
 * @returns {string}
 */
String.prototype.capitalizeFirstLetter = function () {
    return this.charAt(0).toUpperCase() + this.slice(1);
}
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
};
/**
 * @Function Find Next Available Slot for SR
 * Gets the next available time for the user
 * to be sent an SR test
 * @param {Moment} now
 * @param {Array} slots
 * @param {Array} dndTimes for User (the whole week)
 * @return {Object} time: Moment, slot: Object
 */
var findNextAvailableSlotForSR = function (now, slots, dndTimes) {
    var scheduleForSR = {
        time: _.clone(now).add(5, 'minutes'),
        slot: null
    };
    // Schedule a task for the test to be sent to the user
    // at the next available slot (not night time, not in DND time)
    var todayIndex = now.day() - 1;
    // Moment week starts on Sunday, clearly they're stupid and it should be Monday.
    if (todayIndex < 0)
        todayIndex = 6;

    scheduleForSR.slot = _.find(slots, function (slot) {
        return now.hour() >= slot.start && now.hour() < slot.finish;
    });
    var slotIsToday = true;
    for (var i = 0; i < 6; i++) {
        var dndSlotsForToday = dndTimes[todayIndex];
        console.error("DNDSLOTS : " + JSON.stringify(dndSlotsForToday));
        // Check if it's currently sleeping time (scheduleSlot was null) or
        // scheduleSlot is DND for user.
        if (!scheduleForSR.slot || (slotIsToday &&
            _.where(dndSlotsForToday.slots, {label: scheduleForSR.slot.label})[0].active)) {
            scheduleForSR.slot = null;
            // Find the next available slot
            _.each(_.where(dndSlotsForToday.slots, {active: false}), function (slot) {
                if (!scheduleForSR.slot && (now.hour() <= slot.finish || !slotIsToday)) {
                    // Next free slot found
                    scheduleForSR.slot = slot;
                    scheduleForSR.time = _.clone(now).set('hour', slot.start);
                }
            });
        }
        // If still no slots, then today is not a good day.
        if (!scheduleForSR.slot) {
            if(todayIndex === 6)
                todayIndex = 0;
            else
                todayIndex++;
            slotIsToday = false;
        } else
            break;
    }

    return scheduleForSR;
};
var findNextAvailableSlotForSRMiniFunction = function () {

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

        if (!test.isGenerated() && test.title() && user && !test.slug()) {
            promises.push(test.generateSlug(user));
        }
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
});/*
 * TASK WORKER
 */
/*function handleComingFromTask(object) {
 object.unset('silenced_afterSave');
 if (object.has('should_silence_afterSave')) {
 object.unset('should_silence_afterSave');
 object.set('silenced_afterSave', true);
 }
 }

 function setComingFromTask(object) {
 object.set('should_silence_afterSave', true);
 }

 function didComeFromTask(object) {
 return object.has('silenced_afterSave');
 }*/

var WorkTask = Parse.Object.extend('WorkTask');
/**
 * @Function Task Creator
 *
 * @param {String} taskType
 * @param {String} taskAction
 * @param {Object} taskParameters
 * @param {Array} taskObjects
 * @returns {Parse.Promise}
 */
function taskCreator(taskType, taskAction, taskParameters, taskObjects) {
    var task = new WorkTask();
    return task.save({
        'taskType': taskType,
        'taskAction': taskAction,
        'taskParameters': taskParameters,
        'taskObjects': taskObjects,
        'taskClaimed': 0
    }, {useMasterKey: true});
}

// Available actions are defined here and link to their function.
var WorkActions = {
    srCycle: srCycleTask,
    notifyUserForSR: notifyUserForSRTask
};
/**
 * @Task SR Cycle
 * Every 5 minutes, this task loops through
 * SR activated users, finds their URs,
 * generates a test based on their memoryStrength
 * and study intensity and schedules the test to be
 * sent to them at the next available slot.
 *
 * This task is self cycling.
 * @param {String} task
 * @returns {WorkTask}
 */
function srCycleTask(task) {
    Parse.Cloud.useMasterKey();
    var initialPromises = [],
        testsGenerated = 0;

    // Config needed to determine memory thresholds
    initialPromises.push(Parse.Config.get());
    // Query activated users
    var queryForUsers = new Parse.Query(Parse.User);
    queryForUsers.equalTo('srActivated', true);
    queryForUsers.lessThanOrEqualTo('srNextDue', new Date());
    queryForUsers.limit(100);

    initialPromises.push(queryForUsers.find());

    // Loop through users with SR activated and SR due time in the past
    return Parse.Promise.when(initialPromises).then(function (config, users) {
        // Spaced Repetition Category for all SR tests
        var spacedRepetitionCategory = new Category();
        spacedRepetitionCategory.id = config.get('srCategoryId');
        // Per user, we create a promise, and resolve for all before
        // setting this task as complete.
        var perUserPromises = [];
        _.each(users, function (user) {

            // SR Intensity Level for User
            var srIntensityLevel = _.where(config.get('srIntensityLevels'), {level: user.get('srIntensityLevel')})[0],
                urRelation = user.uniqueResponses(),
                urQuery = urRelation.query();
            // Find URs below the user's SR intensity threshold
            urQuery.lessThanOrEqualTo('memoryStrength', srIntensityLevel.upperLimit);
            urQuery.ascending('memoryStrength');
            // Max 30 questions per test (intensity level based)
            // But we shuffle the lowest 60 to be unpredictable
            urQuery.limit(60);
            urQuery.include('question');

            // Get current time based on User's timeZone
            var timeZone = user.get('timeZone'),
                now = moment().tz(timeZone);

            // scheduleSlotForSR contains the *slot* and the exact *time* (Moment)
            // at which this test will be sent to the user.
            var scheduleForSR = findNextAvailableSlotForSR(now, config.get('srDailySlots'),
                user.get('srDoNotDisturbTimes'));

            // Don't cycle through this user again
            // until two hours after the scheduled time for this test.
            // Even if a test is not generated (due to lack of URs for e.g.),
            // this will still be saved.
            var srNextDue = _.clone(scheduleForSR.time).add(2, 'hours');
            user.set('srNextDue', srNextDue.toDate());

            // Begin by getting URs and updating their memory strengths
            var perUserPromise =
                UniqueResponse.findWithUpdatedMemoryStrengths(urQuery).then(function (uniqueResponses) {
                    if (!uniqueResponses.length) {
                        return null;
                    }
                    // Generate the SR test
                    var test = new Test();
                    test.set('isGenerated', true);
                    test.set('isSpacedRepetition', true);
                    test.set('isPublic', false);
                    test.setAuthor(user);
                    test.set('category', spacedRepetitionCategory);
                    test.set('title', "Spaced Practice");
                    test.set('slug', user.get('slug') +
                        "-" + scheduleForSR.time.daysInMonth() + "-" + scheduleForSR.time.month() + "-" +
                        scheduleForSR.time.year() + "-" + scheduleForSR.slot.label);

                    var questions = [],
                        testTags = [];
                    // Though we want mostly questions with the user's lowest memoryStrengths,
                    // we don't want to be completely linear and predictable.
                    // By shuffling the lowest ~60, and then taking the first [maxQuestions],
                    // we have a good mix of UR memoryStrengths.
                    _.each(_.shuffle(uniqueResponses), function (uniqueResponse, index) {
                        if (index < srIntensityLevel.maxQuestions) {
                            questions.push(uniqueResponse.get('question'));
                            _.each(uniqueResponse.get('question').get('tags'), function (tag) {
                                if (!_.contains(testTags, tag))
                                    testTags.push(tag);
                            });
                        }
                    });
                    test.set('questions', questions);
                    test.set('tags', testTags);
                    return test.save();
                }).then(function (test) {
                    if (!test)
                        return;
                    user.set('srLatestTest', test);
                    testsGenerated++;

                    // Save user and create a task for the user to be notified
                    // upon schedule.
                    var innerPromises = [];
                    innerPromises.push(user.save());
                    innerPromises.push(taskCreator('SpacedRepetition', 'notifyUserForSR',
                        {scheduledTime: scheduleForSR.time.toDate()}, [test]));
                    return Parse.Promise.when(innerPromises);
                });
            perUserPromises.push(perUserPromise);
        });
        // Set next SR cycle time to 5 minutes from now.
        perUserPromises.push(taskCreator('SpacedRepetition', 'srCycle',
            {scheduledTime: moment().add(5, 'minutes').toDate()}, []));
        return Parse.Promise.when(perUserPromises);
    }).then(function () {
        var changes = {
            'taskStatus': 'done',
            'taskMessage': testsGenerated + ' test(s) generated.',
            'taskClaimed': 1
        };
        return task.save(changes, {useMasterKey: true});
    }, function (error) {
        console.error(JSON.stringify(error));
    });
}

function notifyUserForSRTask(task) {
    var changes = {
        'taskStatus': 'done',
        'taskMessage': '',
        'taskClaimed': 1
    };
    return task.save(changes, {useMasterKey: true});
}

/**
 * @Function Is Task Scheduled for Now
 * Some tasks are only meant to run at
 * specific times or intervals. Others
 * must be run whenever present.
 * @param {WorkTask} task
 * @returns {boolean}
 */
var isTaskScheduledForNow = function (task) {
    if (!task.get('taskParameters') || !task.get('taskParameters')['scheduledTime'])
        return true;
    var now = moment(),
        scheduledTime = moment(task.get('taskParameters')['scheduledTime']);

    return now.isAfter(scheduledTime);
};

// This background job is scheduled, or run ad-hoc, and processes outstanding tasks.
Parse.Cloud.job('workQueue', function (request, status) {
    Parse.Cloud.useMasterKey();
    var query = new Parse.Query(WorkTask);
    query.equalTo('taskClaimed', 0);
    query.include('taskObjects');
    var processed = 0,
        removed = 0;
    query.each(function (task) {
        // This block will return a promise which is manually resolved to prevent errors from bubbling up.
        var promise = new Parse.Promise();
        processed++;
        var params = task.get('taskParameters'),
            objects = task.get('taskObjects'),
        // The taskClaimed field is automatically incremented to ensure that it is processed only once.
            action = task.get('taskAction');
        // invalid actions not defined by WorkActions are discarded and will not be processed again.
        if (task.get('taskClaimed') == 0 && WorkActions[action] && isTaskScheduledForNow(task)) {
            WorkActions[action](task, params, objects).then(function () {
                promise.resolve();
            }, function () {
                promise.resolve();
            });
        } else {
            promise.resolve();
        }
        return promise;
    }).then(function () {
        var query = new Parse.Query(WorkTask);
        query.equalTo('taskClaimed', 1);
        return query.each(function (task) {
            removed++;
            return task.destroy();
        });
    }).then(function () {
        status.success('Processed: ' + processed + ', Removed ' + removed);
    }, function (err) {
        console.log(err);
        status.error('Something failed!  Check the cloud log.');
    });
});