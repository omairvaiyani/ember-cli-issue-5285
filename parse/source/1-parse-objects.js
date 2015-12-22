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
 * @param {Array<String> || Array<Parse.Object>} objectIds
 * @returns {Array}
 */
Parse.Object.generatePointers = function (className, objectIds) {
    var pointers = [];
    if (!objectIds || !objectIds.length)
        return pointers;

    if (typeof objectIds[0] === "object") {
        // The function has received objects instead, turn it into objectIds.
        objectIds = _.map(objectIds, function (object) {
            return object.id ? object.id : object.objectId;
        });
    }

    _.each(objectIds, function (objectId) {
        pointers.push(Parse.Object.generatePointer(className, objectId));
    });
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
        if (object.id)
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
        Parse.Cloud.useMasterKey();
        return this.fetch();
    } else {
        // This hasn't been tested yet
        // Might not work?
        return Parse.Promise.as(this);
    }
};
/**
 * @Function Fetch srLatestAttempt
 * If srLatestAttempt not loaded, fetch.
 *
 * @returns {Parse.Promise<Parse.Object>}
 */
Parse.Object.prototype.fetchSrLatestAttempt = function () {
    // This is a good, but not foolproof, way to check
    // if the object is fetched or not.
    if (!this.srLatestTest() || !this.srLatestTest().createdAt) {
        // This works.
        var userQuery = new Parse.Query(Parse.User);
        userQuery.include('srLatestTest', 'questions');
        return userQuery.get(this.id).then(function (user) {
            return Parse.Promise.as(user.srLatestTest());
        });
    } else {
        // This hasn't been tested yet
        // Might not work?
        return Parse.Promise.as(this);
    }
};
/**
 * @Function Get Recommended Test
 * Figures out a decent recommended test
 * for the user.
 *
 * @returns {Parse.Promise<Parse.Object>}
 */
Parse.User.prototype.getRecommendedTest = function () {
    var testQueryFilterTags = new Parse.Query(Test);
    testQueryFilterTags.containedIn('tags', this.moduleTags());

    // TODO check for previously used categories by user
    var testQueryFilterCategories = new Parse.Query(Test);
    testQueryFilterCategories.containedIn('tags', this.moduleTags());

    var mainQuery = Parse.Query.or(testQueryFilterTags, testQueryFilterCategories);
    mainQuery.include('author', 'questions');
    mainQuery.notEqualTo('author', this);
    mainQuery.greaterThan('totalQuestions', 4);
    mainQuery.equalTo('isPublic', true);
    mainQuery.notEqualTo('isGenerated', true);
    // Masterkey to find author
    Parse.Cloud.useMasterKey();
    return mainQuery.find().then(function (tests) {
        var recommendedTest = _.shuffle(tests)[0];
        return Parse.Promise.as(recommendedTest);
    }, function (error) {
        console.error("Parse.User.getRecommendedTests error: " + JSON.stringify(error));
    });
};
/**
 * @Function Delete Index Object
 * Removes search index of object
 * @returns {Parse.Promise<Parse.Object>}
 */
Parse.Object.prototype.deleteIndexObject = function () {
    var index;
    switch (this.className) {
        case "Test":
            index = testIndex;
            break;
        case "User":
            index = userIndex;
            break;
    }
    return index.deleteObject(this.id);
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
        "numberOfFollowers", "points", "srIntensityLevel", "numberOfBadgesUnlocked"];
    _.each(numberProps, function (prop) {
        if (this.get(prop) === undefined)
            this.set(prop, 0);
    }.bind(this));

    var arrayProps = ["emailNotifications", "pushNotifications", "earnedBadges",
        "badgeProgressions"];
    _.each(arrayProps, function (prop) {
        this.set(prop, []);
    }.bind(this));

    this.get('emailNotifications').push("receivePromotionalEmails");
    this.set('receivePromotionalEmails', true);

    this.set('isPremium', false);
    this.set('firstTimeLogin', true);
    this.set('level', Level.getFirstLevel());

    return this;
};
/**
 * @Property Minimal Profile
 * This returns a user's profile without any
 * sensitive data. Use this whenever sending
 * a user object through CC or when indexing.
 * @return {Object}
 */
Parse.User.prototype.minimalProfile = function () {
    var object = this.toJSON(),
        propertiesToRemove = ['ACL', 'authData', 'devices', 'email', 'emailNotifications', 'emailVerified',
            'fbEducation', 'followers', 'following', 'gender', 'savedTests', 'srCompletedAttempts', 'testAttempts',
            'fbFriends', 'firstTimeLogin', 'isPremium', 'intercomHash', 'password', 'pushNotifications', 'receivePromotionalEmails',
            'srActivated', 'srDoNotDisturbTimes', 'srLatestTest', 'srIntensityLevel', 'srNextDue', 'srNotifyByEmail',
            'srNotifyByPush', 'stripeToken', 'timeZone', 'username', 'uniqueResponses', 'userEvents'];

    _.each(propertiesToRemove, function (property) {
        object[property] = undefined;
    });
    return object;
};
/**
 * @Property Index Object
 * Minimises user and indexes it for search
 * @return {Parse.Promise}
 */
Parse.User.prototype.indexObject = function () {
    var object = this.minimalProfile();
    object.objectID = this.id;
    // If the user does not have an educationCohort set,
    // the promise will be a synchronous null instead of an error.
    this.fetchEducationCohort().then(function (educationCohort) {
        if (educationCohort) {
            // This converts embedded records to pointers
            object.educationCohort = educationCohort.toJSON();
            // Therefore, we have to define them like this:
            if (educationCohort.studyField())
                object.educationCohort.studyField = educationCohort.studyField().toJSON();
            if (educationCohort.institution())
                object.educationCohort.institution = educationCohort.institution().toJSON();
            // ACLs are only present on the main record
            object.educationCohort.ACL = undefined;
        }
        return userIndex.saveObject(object);
    });
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
 * @Function Assing Badge Progressions
 * Needed for new users
 * @returns {*}
 */
Parse.User.prototype.assignBadgeProgressions = function () {
    var badgesQuery = new Parse.Query(Badge);

    return badgesQuery.find().then(function (badges) {
        var badgeProgressions = [];
        _.each(badges, function (badge) {
            var badgeProgression = new BadgeProgress();
            badgeProgression.set('badge', badge);
            badgeProgression.set('tally', 0);
            badgeProgression.set('badgeLevel', 1);
            badgeProgression.set('currentLevelProgress', 0);
            badgeProgression.set('isUnlocked', false);
            badgeProgressions.push(badgeProgression);
        });
        return Parse.Object.saveAll(badgeProgressions);
    }).then(function (badgeProgressions) {
        this.set('badgeProgressions', badgeProgressions);
        return this;
    }.bind(this));
};

/**
 * @Function Check Level Up
 * Checks if points added will level up
 * the user. If so, the function performs
 * the levelling up and returns a level object
 * if so.
 *
 * User NOT saved
 *
 * @return {Parse.Promise<Level>} levelledUp
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
            return this;
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
                    return this;
                }.bind(this)).then(function () {
                    return Parse.Promise.as(this.level());
                }.bind(this));
            }
        }.bind(this));
    }
    return promise;
};

/**
 * @Function Check Badge Progression
 * Called by UserEvent.newEvent generator.
 *
 * This function may update the received UserEvent,
 * but does not save it - handled in UserEvent.newEvent().
 *
 * This function may update the user object, and save it.
 *
 * @param {UserEvent} userEvent
 * @return {Parse.Promise<Array<BadgeProgress>>}
 */
Parse.User.prototype.checkBadgeProgressions = function (userEvent) {
    var badgesProgressed = [],
        _this = this;

    return this.fetchBadges().then(function (badges) {
        var badgeProgressions = badges.badgeProgressions;
        // Set up UserEvent.badgesProgressedToLevel for historic state sake
        userEvent.set('badgesProgressedToLevel', []);
        // Loop through each badgeProgression
        _.each(badgeProgressions, function (badgeProgression) {
            badgeProgression.relevantEvents().add(userEvent);

            var badge = badgeProgression.badge(),
                totalBadgeLevels = badge.criteria().length,
                badgeLevelCriteria = badge.criteria()[badgeProgression.badgeLevel() - 1];

            var objectToCheck;

            if (badgeLevelCriteria.objectType === "_User") {
                objectToCheck = _this;
            } else {
                objectToCheck = _.filter(userEvent.get('objects'), function (object) {
                    return object.className == badgeProgression.objectType();
                })[0];
            }

            var oldTally = badgeProgression.tally();
            badgeProgression.set('tally', objectToCheck.get(badgeLevelCriteria.attribute));

            if (oldTally !== badgeProgression.tally() &&
                objectToCheck.get(badgeLevelCriteria.attribute) === badgeLevelCriteria.target) {
                // If First Level achieved, add to User.earnedBadges
                if (badgeProgression.badgeLevel() === 1) {
                    // Something wrong with .earnedBadges. Must generate pointer.
                    _this.earnedBadges().push(generatePointer(badge.id, "Badge"));
                    _this.increment('numberOfBadgesUnlocked');
                    badgeProgression.set('isUnlocked', true);
                }

                // Badge Progressed (for UserEvent)
                badgesProgressed.push(badgeProgression);

                // Update UserEvent badgesProgressedToLevel for historic state sake
                userEvent.badgesProgressedToLevel().push(badgeProgression.badgeLevel());

                // Increment badge level if there is a higher level to achieve
                if (badgeProgression.badgeLevel() < totalBadgeLevels) {
                    badgeProgression.increment('badgeLevel');
                    // Update Badge Level Criteria for progress calculation below
                    badgeLevelCriteria = badge.criteria()[badgeProgression.badgeLevel() - 1];
                }
            }

            // Calculate progress, now that badgeLevel may be adjust. 100% max
            var currentTarget = badgeLevelCriteria.target,
                progress = Math.floor((badgeProgression.tally() / currentTarget) * 100);
            if (progress > 100)
                progress = 100;
            badgeProgression.set('currentLevelProgress', progress);
        });
        var promises = [];
        // First save all badgeProgressions (due to tally + currentLevelProgress updates)
        if (badgeProgressions && badgeProgressions.length)
            promises.push(Parse.Object.saveAll(badgeProgressions));

        return Parse.Promise.when(promises);
    }).then(function () {
        // Only return those badges that have progressed (i.e. earned/levelled up)
        return Parse.Promise.as(badgesProgressed);
    });
};
/**
 * @Function Fetch Badges
 * This allows us to fetch the user's earnedBadges
 * and badgeProgressions in one go.
 * @return {Parse.Promise<{earnedBadges: <Array<Badge>>, badgeProgressions: <Array<BadgeProgress>>}>}
 */
Parse.User.prototype.fetchBadges = function () {
    var sameUserQuery = new Parse.Query(Parse.User);
    sameUserQuery.include('earnedBadges');
    sameUserQuery.include('badgeProgressions.badge');

    return sameUserQuery.get(this.id).then(function (user) {
        return Parse.Promise.as({earnedBadges: user.earnedBadges(), badgeProgressions: user.badgeProgressions()});
    }, function (error) {
        console.error("Error fetching badges for user.");
        console.error(error);
        return Parse.Promise.as({});
    });
};
/**
 * @Function Fetch Education Cohort
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
            if (educationCohort.studyField())
                promises.push(educationCohort.studyField().fetch());
            if (educationCohort.institution())
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
    var srLatestTest = this.srLatestTest(),
        promise = new Parse.Promise();
    // User has no level set: this shouldn't happen
    // *once* we set Level 1 by default on sign up.
    if (srLatestTest) {
        var query = new Parse.Query(Test);
        query.include('questions');
        query.get(srLatestTest.id).then(function (test) {
            promise.resolve(test);
        }, function (error) {
            console.error(error);
            promise.resolve(null);
        });
    } else
        promise.resolve(null);

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
 * @Function Estimate Memory Strengths for Tests
 *
 * @Redo Needs rewriting based on SuperMemo topics formula
 *
 * Fetches tests from given pointers. Fetches
 * ALL uniqueResponses by user (reasonable limit).
 *
 * Matches URs with test to see how likely it is
 * that the user has answered similar questions
 * and has some memory of the knowledge tested.
 *
 * Current matches:
 * - Category (1pt/per match)
 * - Tag (1pt/per match)
 *
 * @param {*<Test>} tests (array of pointers)
 * @return {Array<Integer, Test>}
 */
Parse.User.prototype.estimateMemoryStrengthForTests = function (tests) {
    // Fetch tests from testPointers that had no URs
    var testQuery = new Parse.Query(Test);
    testQuery.containedIn("objectId", _.map(tests, function (pointer) {
        return pointer.id;
    }));

    // Fetch all URs for User for memory estimation.
    var allURQuery = this.uniqueResponses().query();
    allURQuery.include('test');
    allURQuery.limit(1000);

    return Parse.Promise.when([testQuery.find(), allURQuery.find()])
        .then(function (tests, uniqueResponses) {
            var estimatedMemoryStrengths = [];

            _.each(tests, function (test) {
                var estimatedMemoryStrength = 0;

                // Category matching
                estimatedMemoryStrength += _.filter(uniqueResponses, function (uniqueResponse) {
                    return uniqueResponse.test().category().id === test.category().id;
                }).length;

                // Tag matching
                estimatedMemoryStrength += _.filter(uniqueResponses, function (uniqueResponse) {
                    var tagMatched = false;
                    _.each(test.tags(), function (tag) {
                        if (!tagMatched)
                            if (_.contains(uniqueResponse.test().tags(), tag))
                                tagMatched = true;
                    });
                    return tagMatched;
                }).length;

                if (estimatedMemoryStrength > 0)
                    estimatedMemoryStrength = estimatedMemoryStrength / 4;
                // Max set to 40 for estimation
                if (estimatedMemoryStrength > 40)
                    estimatedMemoryStrength = 40;

                estimatedMemoryStrength = Math.round(estimatedMemoryStrength);

                estimatedMemoryStrengths.push({test: test, estimatedMemoryStrength: estimatedMemoryStrength});
            });
            return Parse.Promise.as(estimatedMemoryStrengths);
        });
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
 * @returns {Parse.Relation<Test>}
 */
Parse.User.prototype.createdTests = function () {
    return this.relation('createdTests');
};
/**
 * @Property earnedBadges
 * @returns {Array<Parse.Pointer<Badge>>}
 */
Parse.User.prototype.earnedBadges = function () {
    return this.get('earnedBadges');
};
/**
 * @Property email
 * @returns {String}
 */
Parse.User.prototype.email = function () {
    return this.get('email');
};
/**
 * @Property badgeProgressions
 * @returns {Array<Parse.Pointer<BadgeProgress>>}
 */
Parse.User.prototype.badgeProgressions = function () {
    return this.get('badgeProgressions');
};
/**
 * @Property educationCohort
 * @returns {EducationCohort}
 */
Parse.User.prototype.educationCohort = function () {
    return this.get('educationCohort');
};
/**
 * @Property followers
 * @returns {Parse.Relation<Parse.User>}
 */
Parse.User.prototype.followers = function () {
    return this.relation('followers');
};
/**
 * @Property following
 * @returns {Parse.Relation<Parse.User>}
 */
Parse.User.prototype.following = function () {
    return this.relation('following');
};
/**
 * @Property latestTestAttempts
 * @returns {Parse.Relation<Attempt>}
 */
Parse.User.prototype.latestTestAttempts = function () {
    return this.relation('latestTestAttempts');
};
/**
 * @Property level
 * @returns {Level}
 */
Parse.User.prototype.level = function () {
    return this.get('level');
};
/**
 * @Property moduleTags
 * @returns {Array<String>}
 */
Parse.User.prototype.moduleTags = function () {
    return this.get('moduleTags');
};
/**
 * @Property points
 * @returns {integer}
 */
Parse.User.prototype.points = function () {
    return this.get('points');
};
/**
 * @Property savedTests
 * @returns {Parse.Relation<Test>}
 */
Parse.User.prototype.savedTests = function () {
    return this.relation('savedTests');
};
/**
 * @Property srLatestTest
 * @returns {Test}
 */
Parse.User.prototype.srLatestTest = function () {
    return this.get('srLatestTest');
};
/**
 * @Property srLatestTestDismissed
 * @returns {Test}
 */
Parse.User.prototype.srLatestTestDismissed = function () {
    return this.get('srLatestTestDismissed');
};
/**
 * @Property srLatestTestIsTaken
 * @returns {Test}
 */
Parse.User.prototype.srLatestTestIsTaken = function () {
    return this.get('srLatestTestIsTaken');
};
/**
 * @Property srAllTests
 * @returns {Parse.Relation<Test>}
 */
Parse.User.prototype.srAllTests = function () {
    return this.relation('srAllTests');
};
/**
 * @Property srCompletedAttempts
 * @returns {Parse.Relation<Attempt>}
 */
Parse.User.prototype.srCompletedAttempts = function () {
    return this.relation('srCompletedAttempts');
};
/**
 * @Property srNotifyByEmail
 * @returns {boolean}
 */
Parse.User.prototype.srNotifyByEmail = function () {
    return this.get('srNotifyByEmail');
};
/**
 * @Property srNotifyByPush
 * @returns {boolean}
 */
Parse.User.prototype.srNotifyByPush = function () {
    return this.get('srNotifyByPush');
};
/**
 * @Property testAttempts
 * @returns {Parse.Relation<Attempt>}
 */
Parse.User.prototype.testAttempts = function () {
    return this.relation('testAttempts');
};
/**
 * @Property uniqueResponses
 * @returns {Parse.Relation<UniqueResponse>}
 */
Parse.User.prototype.uniqueResponses = function () {
    return this.relation('uniqueResponses');
};
/**
 * @Property userEvents
 * @returns {Parse.Relation}
 */
Parse.User.prototype.userEvents = function () {
    return this.relation('userEvents');
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
     * @Property levelledUp
     *
     * @returns {Level}
     */
    levelledUp: function () {
        return this.get('levelledUp');
    },

    /**
     * @Property badgesProgressed
     *
     * @returns {Array<Parse.Pointer<BadgeProgress>>}
     */
    badgesProgressed: function () {
        return this.get('badgesProgressed');
    },

    /**
     * @Property badgesProgressedToLevel
     * Needed to store for historical state sake,
     * as badgeProgress object will update over
     * time.
     * @returns {Array<Number>}
     */
    badgesProgressedToLevel: function () {
        return this.get('badgesProgressedToLevel');
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
     * Call functions to check if user levelled up
     * and earned a badge or not. These two
     * are then stored on the userEvent object.
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
            var promises = [];
            // Check and handle if User levelled up
            promises.push(user.checkLevelUp());
            // Check and handle if Badge awarded
            promises.push(user.checkBadgeProgressions(userEvent));
            return Parse.Promise.when(promises);
        }).then(function (levelledUp, badgesProgressed) {
            if (levelledUp)
                userEvent.set('levelledUp', levelledUp);
            if (badgesProgressed)
                userEvent.set('badgesProgressed', badgesProgressed);

            // Must save userEvent addition + any points, level or badge changes
            return Parse.Promise.when([user.save(), userEvent.save()]);
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
     * @Function Index Object
     * Converts this into an indexable object
     * and saves it to the search index.
     *
     * Minimises test.author and removes ACL.
     *
     * @returns {Parse.Promise}
     */
    indexObject: function () {
        var object = this.toJSON();
        object.objectID = this.id;
        object.ACL = undefined;
        object._tags = this.tags();
        return this.author().fetchIfNeeded().then(function (author) {
            object.author = author.minimalProfile();
            return testIndex.saveObject(object);
        }.bind(this));
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
     * @Property tags
     * @return {Array}
     */
    tags: function () {
        return this.get('tags');
    },


    /**
     * @Property averageScore
     * @return {Integer}
     */
    averageScore: function () {
        return this.get('averageScore');
    },

    /**
     * @Property averageUniqueScore
     * @return {Integer}
     */
    averageUniqueScore: function () {
        return this.get('averageUniqueScore');
    },

    /**
     * @Property numberOfAttempts
     * @return {Integer}
     */
    numberOfAttempts: function () {
        return this.get('numberOfAttempts');
    },

    /**
     * @Property numberOfUniqueAttempts
     * @return {Integer}
     */
    numberOfUniqueAttempts: function () {
        return this.get('numberOfUniqueAttempts');
    },

    /**
     * @Property totalQuestions
     * @return {Integer}
     */
    totalQuestions: function () {
        return this.get('totalQuestions');
    },

    /**
     * @Property isSpacedRepetition
     * @return {Boolean}
     */
    isSpacedRepetition: function () {
        return this.get('isSpacedRepetition');
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
            "averageUniqueScore", "numberOfAttempts", "numberOfUniqueAttempts",
            "totalQuestions"];

        _.each(numberProps, function (prop) {
            this.set(prop, 0);
        }.bind(this));

        var boolProps = ["isGenerated", "isObjectDeleted",
            "isProfessional", "isSpacedRepetition"];

        _.each(boolProps, function (prop) {
            if (!this.get(prop))
                this.set(prop, false);
        }.bind(this));

        if (!this.questions())
            this.set('questions', []);
        else {
            this.set('totalQuestions', this.questions().length);
        }

        if (this.author()) {
            var ACL = new Parse.ACL(this.author());
            ACL.setPublicReadAccess(this.isPublic());
            ACL.setRoleWriteAccess("admin", true);
            this.setACL(ACL);
        }

        if (!this.get('tags') || !this.get('tags').length)
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
    },

    /**
     * @Function Minify Author Profile
     *
     * If author is present, its sensitive
     * info is removed and the test is returned
     * as a plain Javascript object to send
     * the object without saving it.
     *
     * @returns {Object}
     */
    minifyAuthorProfile: function () {
        if (this.get('author')) {
            var minimalProfile = this.get('author').minimalProfile();
            this.set('author', minimalProfile);

            // This is to avoid error on modifying objects without saving.
            // Else embedded records will be switched to pointers
            var questions = this.questions();
            var category = this.category();
            var testJSON = this.toJSON();
            testJSON.questions = questions;
            testJSON.category = category;
            return testJSON;
        } else
            return this;
    }
}, {
    /**
     * @Function Minify Author Profiles
     *
     * Takes an array of tests with included
     * author profiles and minifies their profiles
     * for security purposes. The returned
     * array is a plain Javascript Array,
     * fit for Cloud code response without
     * saving the modified objects.
     *
     * @param {Array<Test>} tests
     * @returns {Array<Object>}
     */
    minifyAuthorProfiles: function (tests) {
        var testsToJSONArray = [];
        _.each(tests, function (test) {
            testsToJSONArray.push(test.minifyAuthorProfile());
        });
        return testsToJSONArray;
    }
});

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
        return this.get('numberOfResponses') ? this.get('numberOfResponses') : 0;
    },

    /**
     * @Property numberOfCorrectResponses
     * @returns {integer}
     */
    numberOfCorrectResponses: function () {
        return this.get('numberOfCorrectResponses') ? this.get('numberOfCorrectResponses') : 0;
    },

    /**
     * @Property percentOfCorrectResponses
     * @returns {integer}
     */
    percentOfCorrectResponses: function () {
        return this.get('percentOfCorrectResponses') ? this.get('percentOfCorrectResponses') : 0;
    },


    /**
     * @Property numberOfUniqueResponses
     * @returns {integer}
     */
    numberOfUniqueResponses: function () {
        return this.get('numberOfUniqueResponses') ? this.get('numberOfUniqueResponses') : 0;
    },

    /**
     * @Property numberOfCorrectUniqueResponses
     * @returns {integer}
     */
    numberOfCorrectUniqueResponses: function () {
        return this.get('numberOfCorrectUniqueResponses') ? this.get('numberOfCorrectUniqueResponses') : 0;
    },

    /**
     * @Property percentOfCorrectUniqueResponses
     * @returns {integer}
     */
    percentOfCorrectUniqueResponses: function () {
        return this.get('percentOfCorrectUniqueResponses') ? this.get('percentOfCorrectUniqueResponses') : 0;
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
     * @Property difficulty
     * @returns {number}
     */
    difficulty: function () {
        return this.get('difficulty') ? this.get('difficulty') : 50;
    },

    /**
     * @Property tags
     * @returns {Array<String>}
     */
    tags: function () {
        return this.get('tags');
    },

    /**
     * @Function Add New Response Stats
     * Num responses, correct responses,
     * difficulty, etc.
     * @param {Boolean} isCorrect
     * @param {Boolean} isFirst
     * @returns {Question}
     */
    addNewResponseStats: function (isCorrect, isFirst) {
        // All response stats
        this.increment('numberOfResponses');
        if (isCorrect)
            this.increment('numberOfCorrectResponses');
        var percentOfCorrectResponses = Math.round((this.numberOfCorrectResponses() / this.numberOfResponses()) * 100);
        this.set('percentOfCorrectResponses', percentOfCorrectResponses);

        if (isFirst) {
            // Unique response stats
            this.increment('numberOfUniqueResponses');
            if (isCorrect)
                this.increment('numberOfCorrectUniqueResponses');
            var percentOfCorrectUniqueResponses = Math.round(
                (this.numberOfCorrectUniqueResponses() / this.numberOfUniqueResponses()) * 100);
            this.set('percentOfCorrectUniqueResponses', percentOfCorrectUniqueResponses);
        }
        // Difficulty = 100 - average(%correct AND 3x %uniqueCorrect)
        // In plain terms, give uniqueResponses 3x the weight.
        if (this.percentOfCorrectUniqueResponses() > 0) {
            var difficultyModifier = Math.round((percentOfCorrectResponses + (percentOfCorrectUniqueResponses * 3)) / 4);
            this.set('difficulty', 100 - difficultyModifier);
        } else
            this.set('difficulty', 100 - percentOfCorrectResponses);
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

        if (this.isPublic() !== false && this.isPublic() !== true)
            this.set('isPublic', true);

        if (user) {
            var ACL = new Parse.ACL(user);
            this.setACL(ACL);
        }

        if (!this.get('tags') || !this.get('tags').length)
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
     * @Property isFinalised
     * @returns {Boolean}
     */
    isFinalised: function () {
        return this.get('isFinalsied');
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
     * Set if attempt is for a SR test.
     *
     * @returns {Parse.Promise<Attempt>}
     */
    setDefaults: function () {
        if (this.timeCompleted() && this.timeStarted()) {
            var timeTaken = moment(this.timeCompleted()).diff(moment(this.timeStarted()), 'second');
            this.set('timeTaken', timeTaken);
        }

        if (this.score())
            this.set('score', Math.round(this.score()));

        if(!this.responses())
            this.set('responses', []);

        this.set('isFinalised', this.responses().length > 0);

        var ACL = new Parse.ACL();

        if (this.user()) {
            ACL.setReadAccess(this.user(), true);
            ACL.setWriteAccess(this.user(), true);
        } else {
            ACL.setPublicReadAccess(true);
        }
        this.setACL(ACL);

        return this.test().fetchIfNeeded().then(function (test) {
            this.set('isSpacedRepetition', test.isSpacedRepetition());
            return this;
        }.bind(this));
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
     * @Propert correctnessStreak
     * Number of correct responses in a row
     * by user. Needed for Spaced-Repetition.
     * @returns {Integer}
     */
    correctnessStreak: function () {
        return this.get('correctnessStreak');
    },

    /**
     * @Propert previousEasinessFactor
     * Calculated in this.updateMemoryStrength(),
     * Needed for Spaced-Repetition.
     * @returns {Number}
     */
    previousEasinessFactor: function () {
        return this.get('previousEasinessFactor');
    },
    /**
     * @Propert currentOptimumInterval
     * Calculated in this.calculateOptimumRepetitionDate(),
     * Needed for Spaced-Repetition. Interval is in days.
     * @returns {Integer}
     */
    currentOptimumInterval: function () {
        return this.get('currentOptimumInterval');
    },
    /**
     * @Function Set Defaults
     * ACL if user:
     * {user: read}
     * else
     * No need for a public UR.
     * @params {Parse.User} user
     * @returns {UniqueResponse}
     */
    setDefaults: function (user) {
        var ACL = new Parse.ACL();
        if (user) {
            ACL.setReadAccess(user, true);
            this.setACL(ACL);
        }
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
        if (response.isCorrect()) {
            this.increment('numberOfCorrectResponses');
            this.increment('correctnessStreak');
        } else
            this.set('correctnessStreak', 0);

        // For Spaced Repetition
        this.calculateOptimumRepetitionDate();
        // Uses optimum interval from previous function to
        // calculate the current memory strength
        this.updateMemoryStrength();
        this.responses().add(response);
        return this;
    },

    /**
     * @Function Calculate Optimum Repetition Date
     * This function is called post-attempt. It
     * takes previous Unique Response data and
     * decides when the next repetition should occur.
     * @returns {UniqueResponse}
     */
    calculateOptimumRepetitionDate: function () {
        // Before we calculate the next interval, check current memory strength
        // If it's high, that means the user has reviewed this item too early
        // In which case, we'll disallow this repetition in our calculations
        this.updateMemoryStrength();
        if (this.latestResponseIsCorrect() && this.memoryStrength() > 94)
            return this;

        var optimumInterval, // in days (inter-repetition time)
            EF, // easiness-factor
            QF; // quality-factor

        // Only calculate/change EF if QF > 2, i.e. the latest response was correct
        if (this.latestResponseIsCorrect()) {
            // Calculate user's QF on this item
            var grade = percentage(this.numberOfCorrectResponses(), this.numberOfResponses());
            switch (true) {
                // NOTE: not sure why QF is even in the formula for incorrect responses.
                // Incorrect AND less than 19
                case (grade < 20 && !this.latestResponseIsCorrect()):
                    QF = 0;
                    break;
                // Incorrect AND between than 20-40
                case (grade > 19 && grade < 40 && !this.latestResponseIsCorrect()):
                    QF = 1;
                    break;
                // Incorrect AND above than 40
                case (grade > 39 && !this.latestResponseIsCorrect()):
                    QF = 2;
                    break;
                // Correct AND less than 60
                case (grade < 60 && this.latestResponseIsCorrect()):
                    QF = 3;
                    break;
                // Correct AND between 60-80
                case (grade > 59 && grade < 80 && this.latestResponseIsCorrect()):
                    QF = 4;
                    break;
                // Correct AND 80 or above
                case (grade > 79 && this.latestResponseIsCorrect()):
                    QF = 5;
                    break;
            }
            // Calculate item's EF
            var previousEF = this.previousEasinessFactor() ? this.previousEasinessFactor() : 2.5;
            EF = previousEF + (0.1 - (5 - QF) * (0.08 + (5 - QF) * 0.02));
            // EF cannot be below 1.3
            if (EF < 1.3)
                EF = 1.3;

            // Set calculated EF as 'previousEasinessFactor' to be used at next repetition
            this.set('previousEasinessFactor', EF);
        }

        // Calculate optimum interval (in days) based on EF if steak > 2
        if (this.correctnessStreak() < 2) // i.e. got the answer wrong, or right for the first time in a row
            optimumInterval = 1;
        else if (this.correctnessStreak() === 2) // answered correctly twice in a row now
            optimumInterval = 6;
        else {
            // More then 2 correct answers in a row
            // Calculation of interval based on EF and number of correct answers in a row
            optimumInterval = (this.correctnessStreak() - 1) * EF;
        }
        // This will be used to calculate memory strength, and therefore, when to repeat the item
        this.set('currentOptimumInterval', optimumInterval);
        this.set('optimumRepetitionDate', moment().add(Math.round(optimumInterval), 'd').toDate());
        return this;
    },

    /**
     * @Function Update Memory Strength
     * Uses the set 'optimumRepetitionDate' to calculate
     * the current memory strength.
     * @returns {UniqueResponse}
     */
    updateMemoryStrength: function () {
        // Cannot calculate if no responses, or optimum interval has not been calculated yet.
        if (!this.latestResponseDate() || !this.currentOptimumInterval()) {
            this.set('memoryStrength', 0);
            return this;
        }

        // Optimum Interval to repeat is when memoryStrength is 90%.
        // So reverse the calculation to extrapolate the current memoryStrength,
        // accurate to the hour.
        var memoryStrength,
            memoryStrengthDropCutOff = 10,
            hoursSinceLastAttempt = moment().diff(moment(this.latestResponseDate()), 'hours');

        memoryStrength = 100 - (hoursSinceLastAttempt * (memoryStrengthDropCutOff / (this.currentOptimumInterval() * 24)));

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
    getFirstLevel: function () {
        var level = new Level();
        level.id = "sj4HXERITO";
        return level;
    },
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
    },

    /**
     * @Property moduleTags
     * @returns {Array<String>}
     */
    moduleTags: function () {
        return this.get('moduleTags');
    }
}, {});
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
}, {});

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
}, {});

/****
 * -----
 * Badge
 * -----
 *
 **/
var Badge = Parse.Object.extend("Badge", {
    /**
     * @Property title
     * @returns {String}
     */
    title: function () {
        return this.get('title');
    },

    /**
     * @Property description
     * @returns {String}
     */
    description: function () {
        return this.get('description');
    },

    /**
     * @Property eventToMonitor
     * @returns {String}
     */
    eventToMonitor: function () {
        return this.get('eventToMonitor');
    },

    /**
     * @Property criteria
     * [{
     *   badgeLevel: {Number},
     *   objectType: {String},
     *   attribute: {String},
     *   target: {*}
     * }, ...]
     * [
     *  {
     *   "badgeLevel": 1,
     *   "objectType": "_User",
     *   "attribute": "numberOfQuestionsCreated",
     *   "target":1
     *  }
     * ]
     * @returns {Array}
     */
    criteria: function () {
        return this.get('criteria');
    },

    /**
     * @Property icon
     * @returns {Parse.File}
     */
    icon: function () {
        return this.get('icon');
    },

    /**
     * @Property levelIcons
     * @returns {Array<Parse.File>}
     */
    levelIcons: function () {
        return this.get('levelIcons');
    },

    /**
     * @Property isExplicit
     * @returns {String}
     */
    isExplicit: function () {
        return this.get('isExplicit');
    },

    /**
     * @Property isTimeSensitive
     * @returns {String}
     */
    isTimeSensitive: function () {
        return this.get('isTimeSensitive');
    }
}, {});

/****
 * -----
 * BadgeProgress
 * -----
 *
 **/
var BadgeProgress = Parse.Object.extend("BadgeProgress", {
    /**
     * @Property badge
     * @returns {Badge}
     */
    badge: function () {
        return this.get('badge');
    },

    /**
     * @Property tally
     * @returns {Number}
     */
    tally: function () {
        return this.get('tally');
    },

    /**
     * @Property currentLevelProgress
     * @returns {Number}
     */
    currentLevelProgress: function () {
        return this.get('currentLevelProgress');
    },

    /**
     * @Property badgeLevel
     * @returns {Number}
     */
    badgeLevel: function () {
        return this.get('badgeLevel');
    },

    /**
     * @Property relevantEvents
     * @returns {Parse.Relation<UserEvent>}
     */
    relevantEvents: function () {
        return this.relation('relevantEvents');
    },

    /**
     * @Property isUnlocked
     * @returns {boolean>}
     */
    isUnlocked: function () {
        return this.get('isUnlocked');
    }
}, {});