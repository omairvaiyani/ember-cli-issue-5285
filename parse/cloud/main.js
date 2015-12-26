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
    var testQueryFilterFollowing = new Parse.Query(Test),
        innerQueryFollowing = this.following().query();

    testQueryFilterFollowing.matchesQuery('author', innerQueryFollowing);

    var mainQuery = Parse.Query.or(testQueryFilterTags, testQueryFilterFollowing);
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
 * @param {Parse.User} currentUser (optional)
 * @return {Object}
 */
Parse.User.prototype.minimalProfile = function (currentUser) {
    var badgeProgressions = this.badgeProgressions(),
        educationCohort = this.educationCohort(),
        object = this.toJSON();

    object.badgeProgressions = badgeProgressions;
    object.educationCohort = educationCohort;
    object.className = "_User";

    if(currentUser && this.id === currentUser.id)
        return object;

    var propertiesToRemove = ['ACL', 'authData', 'devices', 'email', 'emailNotifications', 'emailVerified',
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
 * Called from Parse.User.beforeSave.
 *
 * Everywhere else should add true
 * for shouldSave.
 *
 * @param {boolean} shouldSave
 * @returns {*}
 */
Parse.User.prototype.assignBadgeProgressions = function (shouldSave) {
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
        if (shouldSave)
            return this.save();
        else
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
 * @Property srActivated
 * @returns {boolean}
 */
Parse.User.prototype.srActivated = function () {
    return this.get('srActivated');
};
/**
 * @Property srDoNotDisturbTimes
 * @returns {Array}
 */
Parse.User.prototype.srDoNotDisturbTimes = function () {
    return this.get('srDoNotDisturbTimes');
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
 * @Property timeZone
 * @returns {String}
 */
Parse.User.prototype.timeZone = function () {
    return this.get('timeZone');
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
     * @Property user
     * @returns {Parse.User}
     */
    user: function () {
        return this.get('user');
    },
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
            if (userEvent.pointsTransacted())
                promises.push(user.checkLevelUp());
            else
                promises.push(false);
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
 * Follow
 * --------
 *
 **/
var Follow = Parse.Object.extend("Follow", {
    /**
     * @Property user
     * @returns {Parse.User}
     */
    user: function () {
        return this.get('user');
    },

    /**
     * @Property following
     * @returns {Parse.User}
     */
    following: function () {
        return this.get('following');
    }
}, {
    followedUser: function (user, userToFollow) {
        var follow = new Follow();
        follow.set('user', user);
        follow.set('following', userToFollow);
        follow.setACL(new Parse.ACL().setPublicReadAccess(true));
        return follow.save();
    },

    unfollowedUser: function (user, userToUnfollow) {
        var unfollowQuery = new Parse.Query(Follow);
        unfollowQuery.equalTo('user', user);
        unfollowQuery.equalTo('following', userToUnfollow);
        return unfollowQuery.find().then(function (result) {
            return Parse.Object.destroyAll(result);
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

        if (!this.responses())
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
}, {});// Concat source to main.js with 'cat source/*.js > cloud/main.js'

var _ = require("underscore"),
    moment = require('cloud/moment-timezone-with-data.js'),
    mandrillKey = 'TUCRsbnixKXZRq2nas_e8g',
    Mandrill = require('mandrill'),
    Stripe = require('stripe'),
    algoliasearch = require('cloud/algoliasearch.parse.js'),
    algoliaClient = algoliasearch('ONGKY2T0Y8', 'b13daea376f182bdee7a089ade58b656'),
    CryptoJS = require('cloud/crypto.js'), // Needed for Intercom hashing
    intercomKey = "Xhl5IzCrI-026mCaD5gqXpoO2WURA416KtCRlWsJ",
    logger = require("cloud/logentries.js"),
    cheerio = require('cloud/cheerio.js'),
    getstream = require('cloud/modules/getstream/getstream.js'),
    GetstreamUtils = require('cloud/modules/getstream/utils.js');

// Algolia Search Master-Indices
var testIndex = algoliaClient.initIndex('Test'),
    userIndex = algoliaClient.initIndex('User');

Mandrill.initialize(mandrillKey);

Stripe.initialize('sk_test_AfBhaEg8Yojoc1hylUI0pdtc'); // testing key
//Stripe.initialize('sk_live_AbPy747DUMLo8qr53u5REcaX'); // live key

// Activity Stream
var GetstreamClient = getstream.connect('fcx4w2mtbg2w', 'gcvxysm55f38rkp837572tpbppgbyhkrmwv6qvv8bq75v7m7e6g89u6jw8dwsthy', '8320');

var APP = {
    baseUrl: 'https://synap.ac/',
    baseCDN: 'https://s3-eu-west-1.amazonaws.com/synap-dev-assets/',
    takeTest: 'mcq/',
    testInfo: 'test/',
    userSettings: 'settings/',
    userStudySettings: 'settings/study/'
};/*
 * HELPER CLASSES
 */
/**
 * @Function Capitalize
 * @returns {string}
 */
String.prototype.capitalizeFirstLetter = function () {
    return this.charAt(0).toUpperCase() + this.slice(1);
};
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
 * @Function Camel Case to Normal
 * turnsThis to turns this
 * Or if capitalize
 * turnsThis to Turns This
 * @param {Boolean} capitalize (optional)
 * @returns {String}
 */
String.prototype.camelCaseToNormal = function (capitalize) {
    var normal = this.replace(/([A-Z])/g, ' $1');
    if (capitalize)
        return normal.replace(/^./, function (str) {
            return str.toUpperCase();
        });
    else
        return normal.toLowerCase();
};

/**
 * @Function Starts With
 * @param {String} prefix
 * @returns {boolean}
 */
String.prototype.startsWith = function (prefix) {
    return this.slice(0, prefix.length) == prefix;
};

/**
 * @Function Humanize
 * Converts string array
 * to readble english.
 * i.e. ["GOSH", "PAEDs", "ACC"] > "GOSH, PAEDs and ACC"
 * @return {String}
 */
Array.prototype.humanize = function () {
    if (this.length < 2)
        return this[0];
    else if (this.length === 2)
        return this[0] + " and " + this[1];
    else {
        var last = _.clone(this).pop();
        this.pop();
        return this.join(", ") + " and " + last;
    }
};

/**
 * @Function Percentage
 * @param {integer} number1
 * @param {integer} number2
 * @returns {number}
 */
var percentage = function (number1, number2) {
    if (!number1 || number2)
        return 0;
    return Math.floor((number1 / number2) * 100);
};
/**
 * @Function Generate Pointer
 * @param {string} objectId
 * @param {string} className
 * @returns {Object} pointer
 */
var generatePointer = function (objectId, className) {
    if (!objectId || !className)
        return "";

    return {
        "__type": "Pointer",
        "className": className,
        "objectId": objectId
    };
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
    var daysAhead = 0;
    // Moment week starts on Sunday, clearly they're stupid and it should be Monday.
    if (todayIndex < 0)
        todayIndex = 6;

    scheduleForSR.slot = _.find(slots, function (slot) {
        return now.hour() >= slot.start && now.hour() < slot.finish;
    });

    // Even if slot was found, run the loop from today
    // to see if they have set a DND slot.
    var slotIsToday = true;

    for (var i = 0; i < 6; i++) {
        var dndSlotsForToday = dndTimes[todayIndex];

        // Check if it's currently sleeping time (scheduleSlot was null) or
        // scheduleSlot is DND for user.

        if (!scheduleForSR.slot || (slotIsToday &&
            _.where(dndSlotsForToday.slots, {label: scheduleForSR.slot.label})[0].active)) {
            scheduleForSR.slot = null;

            // Find the next available slot
            _.each(_.where(dndSlotsForToday.slots, {active: false}), function (slot) {
                if (!scheduleForSR.slot && (now.hour() < slot.finish || !slotIsToday)) {
                    // Next free slot found
                    scheduleForSR.slot = slot;
                    // Add days (0 if today), set hour to start of slot
                    scheduleForSR.time = _.clone(now).add(daysAhead, "d").set('hour', slot.start);
                }
            });
        }
        // If still no slots, then today is not a good day.
        if (!scheduleForSR.slot) {
            if (todayIndex === 6)
                todayIndex = 0;
            else
                todayIndex++;
            slotIsToday = false;
            daysAhead++;
        } else
            break;
    }

    return scheduleForSR;
};
/**
 * Send Email
 *
 * @param {string} templateName
 * @param {string} email
 * @param {Parse.User} user
 * @param {Array} data
 */
var sendEmail = function (templateName, email, user, data) {
    var promise = new Parse.Promise();
    /*
     * Send welcome email via Mandrill
     */
    if (!email || !email.length) {
        promise.reject("No email given");
        return promise;
    }

    var firstName = "",
        fullName = "",
        globalData = data ? data : [];

    if (user && user.get('name')) {
        fullName = user.get('name');
        firstName = fullName.split(" ")[0];
        globalData.push({"name": "FNAME", "content": firstName});
    }

    // defaults
    globalData.push({"name": "CURRENT_YEAR", "content": moment().format("YYYY")});
    globalData.push({"name": "COMPANY", "content": "Synap"});
    globalData.push({"name": "ADDRESS", "content": "Leeds Innovation Center, UK"});
    globalData.push({"name": "UPDATE_PROFILE", "content": APP.baseUrl + APP.userSettings});

    var subject;
    switch (templateName) {
        case 'welcome-email':
            subject = "Hey " + firstName + ", welcome to Synap!";
            break;
        case 'forgotten-password':
            subject = "Reset your Synap password.";
            break;
        case 'beta-invitation':
            subject = "You've been invited to Synap!";
            break;
        case 'spaced-repetition':
            subject = "Synap Quiz Ready";
            break;
        case 'daily-recap':
            subject = "Synap Daily Recap";
            break;
    }

    logger.log("send-email", "About to send " + templateName + "  email to " + email,
        globalData);
    return Mandrill.sendTemplate({
        template_name: templateName,
        template_content: [],
        message: {
            subject: subject,
            from_email: "support@synap.ac",
            from_name: "Synap",
            global_merge_vars: globalData,
            to: [
                {
                    email: email,
                    name: fullName ? fullName : firstName
                }
            ]
        },
        async: true
    }, {
        success: function (httpResponse) {
            console.log("Sent " + templateName + " email: " + JSON.stringify(httpResponse));
        },
        error: function (httpResponse) {
            console.error("Error sending " + templateName + "  email: " + JSON.stringify(httpResponse));
        }
    });
};

var getAuthorsFromTestsSearch = function (tests) {
    var authorObjectIds = [];
    _.each(tests, function (test) {
        if (test.author && test.author.objectId) {
            authorObjectIds.push(test.author.objectId);
        }
    });
    logger.log("authorObjectIds", authorObjectIds);
    var authorQuery = new Parse.Query(Parse.User);
    authorQuery.containedIn("objectId", authorObjectIds);
    return authorQuery.find().then(function (authors) {
        logger.log("authors-found", authors.length);
        var minimisedAuthors = [];
        _.each(authors, function (author) {
            minimisedAuthors.push(author.minimalProfile());
        });
        logger.log("minified-authors", minimisedAuthors);
        _.each(tests, function (test) {
            test.author = _.filter(minimisedAuthors, function (author) {
                return author.objectId === test.author.objectId;
            })[0];
        });
        return tests;
    });
};/*
 * BACKGROUND JOBS
 */

/**
 * @BackgroundJob TEMP Replicate Followers on Stream
 *
 * Call when truncating follower relations on Stream
 *
 */
Parse.Cloud.job('TEMP_replicateFollowersOnStream', function (request, status) {
    Parse.Cloud.useMasterKey();

    var totalFollowingsAdded = 0;

    var userQuery = new Parse.Query(Parse.User);
    userQuery.greaterThan('numberFollowing', 0);
    userQuery.find().then(function (users) {
        var perUserPromise = [];
        _.each(users, function (user) {
            var followingRelationQuery = user.following().query();
            var promise = followingRelationQuery.find().then(function (following) {
                var followPromises = [];
                _.each(following, function (userToFollow) {
                    followPromises.push(Parse.Cloud.run('followUser', {userIdToFollow: userToFollow.id, currentUserId: user.id}));
                    totalFollowingsAdded++;
                });
                return Parse.Promise.when(followPromises);
            });
            perUserPromise.push(promise);
        });
        return Parse.Promise.when(perUserPromise);
    }).then(function () {
        status.success("Added " + totalFollowingsAdded + " follow relations");
    }, function (error) {
        status.error(error);
    });
});/*
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
        promises.push(user.assignBadgeProgressions());
        promises.push(user.generateSlug());
    } else {
        if (user.dirtyKeys() && _.contains(user.dirtyKeys(), "email")) {
            user.username = user.get('email');
        }
    }
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
    var user = request.object,
        promises = [];

    Parse.Cloud.useMasterKey();
    if (!user.existed()) {
        // ACLs can only be set after the first save
        // Hashes for Intercom can be created here
        var userACL = new Parse.ACL(user);
        userACL.setPublicReadAccess(false);
        userACL.setRoleReadAccess("admin", true);
        userACL.setRoleWriteAccess("admin", true);
        user.setACL(userACL);
        // Need a hash for secure client-intercom messaging
        // NOTE: storing as string might not work?
        user.set('intercomHash', CryptoJS.SHA256(user.id, intercomKey).toString());
        promises.push(user.save());
    } else {
        // Old user
        if (!user.get('intercomHash')) {
            // Only needed whilst testing, previous statement suffice
            user.set('intercomHash', CryptoJS.SHA256(user.id, intercomKey).toString());
            promises.push(user.save());
        }
    }
    // Add/Update search index (async)
    promises.push(user.indexObject());
    return Parse.Promise.when(promises);
});
/**
 * @afterDelete User
 * Removes from search index.
 */
Parse.Cloud.afterDelete(Parse.User, function (request) {
    var object = request.object;
    return userIndex.deleteObject(object.id);
});

/**
 * @beforeSave Test
 *
 * New test:
 * - Set default parameters + ACL
 * - Generate slug (async)
 *
 * Existing test:
 * - Issue with deleted questions not being removed
 * due to __AddUnique REST call. Here we check if
 * a question should be removed from the test.
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
    } else {
        // Existing test
        test.set('totalQuestions', test.questions().length);

        if (_.contains(test.dirtyKeys(), "isPublic")) {
            // publicity has changed, so update that on
            // the questions within the test.
            _.each(test.questions(), function (question) {
                // Not setting this up as task as users
                // might toggle publicity too quickly.
                question.set('isPublic', test.isPublic());
                question.save();
            });
            // If publicity is now private, remove from search index.
            if (!test.isPublic()) {
                promises.push(test.deleteIndexObject());
            }
            var ACL = test.getACL();
            ACL.setPublicReadAccess(test.isPublic());
            test.setACL(ACL);
        }
    }

    Parse.Promise.when(promises).then(function () {
        response.success();
    }, function (error) {
        response.error(error);
    });
});

/**
 * @afterSave Test
 *
 */
Parse.Cloud.afterSave(Test, function (request) {
    var test = request.object;

    if (!test.existed()) {
        // New test logic
    } else {
        // Existing test logic
    }
    if (test.isPublic()) {
        // Add/Update search index (async)
        test.indexObject();
    }
});

/**
 * @afterDelete Test
 * Removes from search index.
 */
Parse.Cloud.afterDelete(Test, function (request) {
    var object = request.object;
    return testIndex.deleteObject(object.id);
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
    // Update ACL each time.
    var ACL = question.getACL();
    ACL.setPublicReadAccess(question.isPublic());
    question.setACL(ACL);

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
        promises = [];

    if (attempt.isNew()) {
        promises.push(attempt.setDefaults());
    }

    if (!attempt.isFinalised() && attempt.responses().length) {
        var ACL = attempt.getACL();
        ACL.setWriteAccess(attempt.user(), false);
        attempt.setACL(ACL);
        attempt.set('isFinalised', true);
    }

    Parse.Promise.when(promises).then(function () {
        response.success();
    }, function (error) {
        response.error(error);
    });
});


/**
 * @afterSave Attempt
 *
 * New Attempt:
 * - Set task for test stats to be updated
 * - Update user attempts relations
 */
Parse.Cloud.afterSave(Attempt, function (request) {
    var attempt = request.object,
        user = request.user,
        promises = [];

    if (!attempt.existed()) {
        // Test stats will be updated within 60 seconds
        var taskCreatorPromise = taskCreator('Statistics', 'updateTestStatsAfterAttempt',
            {}, [attempt.test(), attempt.questions(), attempt, user]);

        var userUpdatePromise = attempt.test().fetchIfNeeded().then(function (test) {
            // All Spaced Rep attempts go here
            if (test.isSpacedRepetition()) {
                user.srCompletedAttempts().add(attempt);
                // user.srLatestTestIsTaken dictates if a new sr test will be generated or not
                // safety net: check if srLatestTest is set on user
                if (!user.get('srLatestTest') || test.id === user.get('srLatestTest').id)
                    user.set('srLatestTestIsTaken', true);
            }
            // All other non-generated attempts go here
            else if (!test.isGenerated())
                user.testAttempts().add(attempt);

            // Find previous 'latestTestAttempts' for this test+user
            var latestAttemptsQuery = user.latestTestAttempts().query();
            latestAttemptsQuery.equalTo('test', test);
            return latestAttemptsQuery.find();
        }).then(function (previousAttempts) {
            // Ideally, there should be 0 or 1 previousAttempts.
            // But if a bug caused multiple previousAttempts on the
            // same test, we'll make sure they're removed in this
            // instance.
            _.each(previousAttempts, function (previousAttempt) {
                user.latestTestAttempts().remove(previousAttempt);
            });
            // Add this new attempt as the latest
            user.latestTestAttempts().add(attempt);
            return user.save();
            /*
             TODO remove this once set up on afterSave.UserEvent
             promises.push(updateActivityStream(request, {
             actor: user,
             object: attempt.test(),
             feedSlug: "user",
             feedUserId: attempt.user().id,
             verb: "took quiz",
             to: attempt.test().author(),
             score: attempt.score()
             }));*/

        });

        promises.push(taskCreatorPromise);
        promises.push(userUpdatePromise);
    }
    Parse.Promise.when(promises);
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
        promises = [];

    if (responseObject.isNew()) {
        responseObject.setDefaults();
    }

    Parse.Promise.when(promises).then(function () {
        response.success();
    }, function (error) {
        response.error(error);
    });
});

/**
 * @beforeSave UniqueResponse
 *
 * New UniqueResponse:
 * - Update response.question with unique stats
 * Else if new response is added:
 * - Update response.question with non-unique stats
 */
Parse.Cloud.beforeSave(UniqueResponse, function (request, response) {
    var uniqueResponse = request.object,
        user = request.user,
        promises = [];

    //  We only want to update question stats when new response is added.
    //  URs can be saved during background jobs, therefore, check dirtyKeys
    //  number of responses has changed.
    if (_.contains(uniqueResponse.dirtyKeys(), "numberOfResponses")) {
        uniqueResponse.setDefaults(user);

        var questionPromise = uniqueResponse.question().fetchIfNeeded()
            .then(function (question) {
                if (question) {
                    question.addNewResponseStats(uniqueResponse.latestResponseIsCorrect(), uniqueResponse.isNew());
                    return question.save(null, {useMasterKey: true});
                }
            });
        promises.push(questionPromise);
    }

    Parse.Promise.when(promises).then(function () {
        response.success();
    }, function (error) {
        response.error(error);
    });
});

/**
 * @AfterSave Follow
 * Activity Stream
 */
Parse.Cloud.afterSave(Follow, function (request) {
    var follow = request.object,
        promises = [];
    if (!follow.existed()) {
        logger.log("activity-stream", "saving follow");

        promises.push(addActivityToStream(follow.user(), "followed", follow, [follow.following()], follow.following()));

        var flat = GetstreamClient.feed('flat', follow.user().id);
        promises.push(flat.follow('user', follow.following().id, GetstreamUtils.createHandler(logger)));
    }

    return Parse.Promise.when(promises); // Keep alive till done
});

/**
 * @AfterDelete Follow
 * Remove Activity Stream and Following User from
 * Current User.
 */
Parse.Cloud.afterDelete(Follow, function (request) {
    var follow = request.object,
        promises = [];

    // trigger fanout & unfollow
    var feed = GetstreamClient.feed('user', follow.user().id),
        activity = GetstreamUtils.parseToActivity({
            actor: follow.user(),
            object: follow,
            verb: "followed"
        });

    logger.log("activity-stream", "remove follow", activity);
    promises.push(feed.removeActivity({
        foreignId: activity.foreign_id
    }, GetstreamUtils.createHandler(logger)));

    // Remove previously followed user from user's feed
    var flat = GetstreamClient.feed('flat', follow.user().id);
    promises.push(flat.unfollow('user', follow.following().id, GetstreamUtils.createHandler(logger)));

    return Parse.Promise.when(promises);
});/*
 * CLOUD FUNCTIONS
 */

/**
 * @Deprecated see initializeApp
 * @CloudFunction Initialise Website for User
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
 * - earnedBadges (no limit)
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
        createdTestsQuery.limit(100);
        promises.push(createdTestsQuery.find());

        var savedTestsRelation = user.relation('savedTests'),
            savedTestsQuery = savedTestsRelation.query();

        savedTestsQuery.notEqualTo('isObjectDeleted', true);
        savedTestsQuery.notEqualTo('isSpacedRepetition', true);
        savedTestsQuery.ascending('title');
        savedTestsQuery.include('questions', 'author');
        savedTestsQuery.limit(10);
        promises.push(savedTestsQuery.find());

        // Get uniqueResponses only for tests that are being
        // sent to the user in this instance.
        var uniqueResponsesRelation = user.relation('uniqueResponses'),
            uniqueResponsesForCreatedTestsQuery = uniqueResponsesRelation.query(),
            uniqueResponsesForSavedTestsQuery = uniqueResponsesRelation.query();
        // uniqueResponses on createdTests
        uniqueResponsesForCreatedTestsQuery.matchesQuery('test', createdTestsQuery);
        // uniqueResponses on savedTests
        uniqueResponsesForSavedTestsQuery.matchesQuery('test', savedTestsQuery);
        // Find uniqueResponses in either of the above two queries
        var uniqueResponsesQuery = Parse.Query.or(uniqueResponsesForCreatedTestsQuery,
            uniqueResponsesForSavedTestsQuery);
        uniqueResponsesQuery.include('test');
        uniqueResponsesQuery.limit(1000);

        // Perform the query, then update memoryStrength + save
        promises.push(UniqueResponse.findWithUpdatedMemoryStrengths(uniqueResponsesQuery));

        if (user.srLatestTest()) {
            promises.push(user.fetchSRLatestTest());
        }
        // Seems to be a limit of 6 parallel promises
    }
    return Parse.Promise.when(promises)
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
                latestTestAttemptsQuery.limit(10);
                latestTestAttemptsQuery.descending("createdAt");
                promises.push(latestTestAttemptsQuery.find());

                // Get Earned Badges and Progressions
                //promises.push(user.fetchBadges());

                return Parse.Promise.when(promises);
            }
        }).then(function (educationCohort, srAllTests, latestTestAttempts, badges) {
            result["educationCohort"] = educationCohort;
            result["srAllTests"] = srAllTests;
            result["latestTestAttempts"] = latestTestAttempts;
            //result["earnedBadges"] = badges.earnedBadges;
            //result["badgeProgressions"] = badges.badgeProgressions;

            response.success(result);
        }, function (error) {
            if (error)
                response.error(error);
            else
                response.error("Something went wrong.");
        });
});

/**
 * @CloudFunction Initialise App
 *
 * Initialises client-app
 * - Config
 * - Categories
 * IF User
 * - Embed pointers
 * - - EducationCohort (with Institution and StudyField)
 * - - Level
 * - - EarnedBadges
 * - - BadgeProgressions (with Badge)
 * - Get Notification Feed
 *
 * @return {Object} {config, categories, user}
 */
Parse.Cloud.define('initialiseApp', function (request, response) {
    var user = request.user,
        promises = [];

    // For all initialisations, get Parse.Config and Array<Category>
    promises.push(Parse.Config.get());
    promises.push(new Parse.Query(Category).include("parent").find());

    // If logged in, update currentUser with all pointers included
    // This is because Parse.User.become(sessionToken) is inflexible
    if (user) {
        var userQuery = new Parse.Query(Parse.User);
        userQuery.include('level');
        userQuery.include('educationCohort.studyField', 'educationCohort.institution');
        userQuery.include('earnedBadges');
        userQuery.include('badgeProgressions.badge');
        promises.push(userQuery.get(user.id));

        promises.push(Parse.Cloud.run('fetchActivityFeed', {feed: "notification:" + user.id}));
    }

    Parse.Promise.when(promises).then(function (config, categories, user, notifications) {
        var result = {
            config: config,
            categories: categories,
            user: user,
            notifications: notifications
        };
        response.success(result);
    }, function (error) {
        response.error(error);
    });

});

/**
 * @CloudFunction Load My Tests List
 *
 * Done as part of client-app initiation
 * - Created Tests
 * - Saved Tests
 */
Parse.Cloud.define('loadMyTestsList', function (request, response) {
    var user = request.user,
        promises = [];

    if (!user)
        return response.error("You must be logged in.");

    var createdTestsQuery = user.createdTests().query();
    createdTestsQuery.ascending('title');
    createdTestsQuery.limit(50);
    createdTestsQuery.notEqualTo('isObjectDeleted', true);
    createdTestsQuery.notEqualTo('isSpacedRepetition', true);
    promises.push(createdTestsQuery.find());

    var savedTestsQuery = user.savedTests().query();
    savedTestsQuery.ascending('title');
    savedTestsQuery.include('author');
    savedTestsQuery.limit(50);
    savedTestsQuery.notEqualTo('isObjectDeleted', true);
    savedTestsQuery.notEqualTo('isSpacedRepetition', true);
    Parse.Cloud.useMasterKey();
    promises.push(savedTestsQuery.find());

    Parse.Promise.when(promises).then(function (createdTests, savedTests) {
        var result = {
            createdTests: createdTests,
            savedTests: Test.minifyAuthorProfiles(savedTests)
        };
        response.success(result);
    }, function (error) {
        response.error(error);
    });

});


/**
 * @CloudFunction Load Followers and Following
 * @Temporary This won't be efficient past 100 users
 * TODO create an on-the-fly function to check followers/following
 *
 * Done as part of client-app initiation
 * - Followers
 * - Following
 */
Parse.Cloud.define('loadFollowersAndFollowing', function (request, response) {
    var user = request.user,
        promises = [];

    Parse.Cloud.useMasterKey();
    if (!user)
        return response.error("You must be logged in.");

    var followersQuery = user.followers().query();
    followersQuery.limit(100);
    followersQuery.include('educationCohort');
    followersQuery.notEqualTo('isObjectDeleted', true);
    promises.push(followersQuery.find());

    var followingQuery = user.following().query();
    followingQuery.limit(100);
    followingQuery.notEqualTo('isObjectDeleted', true);
    followingQuery.include('educationCohort');
    promises.push(followingQuery.find());

    Parse.Promise.when(promises).then(function (followers, following) {
        var minifiedFollowers = [];
        _.each(followers, function (follower) {
            minifiedFollowers.push(follower.minimalProfile());
        });
        var minifiedFollowing = [];
        _.each(following, function (followee) {
            minifiedFollowing.push(followee.minimalProfile());
        });

        var result = {
            followers: minifiedFollowers,
            following: minifiedFollowing
        };
        response.success(result);
    }, function (error) {
        response.error(error);
    });

});

/**
 * @CloudFunction Load Recent Attempts for User
 *
 * Used for Progress page
 * - Recent Test attempts
 */
Parse.Cloud.define('loadRecentAttemptsForUser', function (request, response) {
    Parse.Cloud.useMasterKey();
    var user = request.user;

    if (!user)
        return response.error("You must be logged in.");

    var recentTestAttemptsQuery = user.testAttempts().query();
    recentTestAttemptsQuery.include('test.author');
    recentTestAttemptsQuery.limit(20);
    recentTestAttemptsQuery.descending("createdAt");

    recentTestAttemptsQuery.find().then(function (recentAttempts) {
        var attemptsToInclude = [],
            minifiedAuthors = [];
        _.each(recentAttempts, function (attempt) {
            // Only include attempts where test AND author exist
            if (attempt.test() && attempt.test().author()) {
                attemptsToInclude.push(attempt);
                // Only minify unique authors
                if (!_.find(minifiedAuthors, function (author) {
                        return author.objectId === attempt.test().author().id;
                    }))
                    minifiedAuthors.push(_.clone(attempt.test().author()).minimalProfile());
            }
        });

        var result = {
            recentAttempts: attemptsToInclude,
            authors: minifiedAuthors
        };
        response.success(result);
    }, function (error) {
        response.error(error);
    });

});

/**
 * @CloudFunction Load Recent Sr Attempts for User
 *
 * Used for Progress page
 * - Recent srCompletedAttempts attempts
 */
Parse.Cloud.define('loadRecentSrAttemptsForUser', function (request, response) {
    Parse.Cloud.useMasterKey();
    var user = request.user;

    if (!user)
        return response.error("You must be logged in.");

    var srAttemptsQuery = user.srCompletedAttempts().query();
    srAttemptsQuery.include('test');
    srAttemptsQuery.limit(20);
    srAttemptsQuery.descending("createdAt");

    srAttemptsQuery.find().then(function (srCompletedAttempts) {
        var attemptsToInclude = [];

        _.each(srCompletedAttempts, function (attempt) {
            // Only include attempts where test AND author exist
            if (attempt.test()) {
                attemptsToInclude.push(attempt);
            }
        });

        var result = {
            srCompletedAttempts: srCompletedAttempts
        };
        response.success(result);
    }, function (error) {
        response.error(error);
    });

});

/**
 * @CloudFunction Refresh Tiles for User
 *
 * Call on app load and subsequently every
 * five minutes to get new recommendations
 * and updates.
 *
 * @return {Array<Object> tiles}
 */
Parse.Cloud.define('refreshTilesForUser', function (request, response) {
    var user = request.user,
        tiles = [],
        srLatestTest,
        recommendTest,
        promises = [];

    if (!user)
        return response.error("You must be logged in.");

    // Will use this eventually to shuffle and select random tiles
    var typesOfTiles = ["spacedRepetition", "recommendedTest", "promptToActivateSR"];

    var tilesToFetch = ["recommendedTest"];
    if (user.srActivated() && !user.srLatestTestDismissed() && !user.srLatestTestIsTaken())
        tilesToFetch.push("spacedRepetition");

    if (!user.srActivated())
        tilesToFetch.push("promptToActivateSR");

    _.each(tilesToFetch, function (tileToFetch) {
        switch (tileToFetch) {
            case "spacedRepetition":
                promises.push(srLatestTest = user.fetchSrLatestAttempt());
                break;
            case "recommendedTest":
                promises.push(recommendTest = user.getRecommendedTest());
                break;
            case "promptToActivateSR":
                tiles.push({
                    type: "default",
                    label: "Activate Spaced Repetition",
                    title: "Optimise Your Study",
                    iconUrl: APP.baseCDN + 'img/features/srs-icon.png',
                    actionName: 'goToRoute',
                    actionLabel: 'Study Settings',
                    routePath: 'settings.study'
                });
                break;
        }
    });
    Parse.Promise.when(promises).then(function () {
        // Can't add promise results as params on this function
        // as the order is shuffled. Result stored in _result[0].
        if (srLatestTest && (srLatestTest = srLatestTest._result[0])) {
            tiles.push({
                type: "spacedRepetition",
                label: "Spaced Repetition",
                title: srLatestTest.title(),
                iconUrl: APP.baseCDN + 'img/features/srs-icon.png',
                actionName: 'openTestModal',
                actionLabel: 'Take Quiz',
                test: srLatestTest
            });
        }
        if (recommendTest && (recommendTest = recommendTest._result[0])) {
            tiles.push({
                type: "recommendedTest",
                label: "Recommended for you",
                title: recommendTest.title(),
                iconUrl: APP.baseCDN + 'img/features/take-quiz.png',
                actionName: 'openTestModal',
                actionLabel: 'Take Quiz',
                test: recommendTest.minifyAuthorProfile()
            });
        }
        response.success({tiles: tiles});
    }, function (error) {
        response.error(error);
    });
});

/**
 * @CloudFunction Get Memory Strength for Tests
 * You can send an array of tests, test pointers or test objectIds.
 * @param {Array<Test> || Array<Parse.Pointers> || Array<String>} tests
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
 *
 * Request param 'test' must be JSON,
 * not Parse.Object.
 *
 * @param {Object} test
 * @return {UserEvent} userEvent
 */
Parse.Cloud.define('createNewTest', function (request, response) {
    var user = request.user,
        testPayload = request.params.test,
        test = Parse.Object.createFromJSON(testPayload, "Test");

    test.save().then(function () {
        // Update Basic Stat, user will be saved during UserEvent generation
        user.increment('numberOfTestsCreated');
        user.createdTests().add(test);
        // Creates a new userEvent and increments the users points.
        return UserEvent.newEvent(UserEvent.CREATED_TEST, test, user);
    }).then(function (userEvent) {
        // Check Level Up has been moved to UserEvent.newEvent(), and stored on userEvent.
        // return user.checkLevelUp();
        return response.success({userEvent: userEvent, test: test});
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
 * @return [{UserEvent},{Question}] userEvent, question
 */
Parse.Cloud.define('saveNewQuestion', function (request, response) {
    var user = request.user,
        test = request.params.test,
        questionPayload = request.params.question,
        question = Parse.Object.createFromJSON(questionPayload, "Question");

    question.save().then(function () {
        // Update Basic Stat, user will be saved during UserEvent generation
        user.increment('numberOfQuestionsCreated');
        // Creates a new userEvent and increments the users points.
        return UserEvent.newEvent(UserEvent.ADDED_QUESTION, [question, test], user);
    }).then(function (userEvent) {
        //  Check Level Up handled in UserEvent.newEvent, and stored on eventObject
        //  return user.checkLevelUp();
        return response.success({userEvent: userEvent, question: question});
    }, function (error) {
        response.error(error);
    });
});
/**
 * @CloudFunction New User Event
 * @param {Array<Parse.Object>} objects
 * @param {String} type
 * @return {UserEvent} userEvent
 */
Parse.Cloud.define('newUserEvent', function (request, response) {
    var user = request.user,
        objects = request.params.objects ? request.params.objects : [],
        type = request.params.type;

    if (!user)
        return response.error("You must be logged in.");

    // Creates a new userEvent and increments the users points.
    UserEvent.newEvent(type, objects, user).then(function (userEvent) {
        return response.success({userEvent: userEvent});
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
            promise = objectQuery.each(function (object) {
                object.set('isObjectDeleted', true);
                object.set('isPublic', false);
                object.setACL(new Parse.ACL());
                return object.save();
            });
            break;
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
        query = new Parse.Query(Test),
        requestFromAuthor = false;

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
        if (!test || !test.author())
            return response.error("Test not found or test author not found.");

        if (user && user.id === test.author().id)
            requestFromAuthor = true;

        // Query includes private tests in case the test
        // belongs to the user. We check it manually here.
        if (!requestFromAuthor) {
            if (!test.get('isPublic'))
                return response.error("You do not have permission to view this test.");

            test = test.minifyAuthorProfile();
        }

        response.success(test);
    }, function (error) {
        response.error(error);
    });
});

/**
 * @CloudFunction Get Attempt
 *
 * Used so that attempt.test.author
 * is fetched too.
 *
 * @return {String} id
 */
Parse.Cloud.define('getAttempt', function (request, response) {
    var user = request.user,
        id = request.params.id;

    Parse.Cloud.useMasterKey();
    var attemptQuery = new Parse.Query(Attempt);
    attemptQuery.include('test.author');
    attemptQuery.include('responses');
    attemptQuery.include('questions');

    attemptQuery.get(id).then(function (attempt) {
        var requestFromAuthor = false;
        if (user && user.id === attempt.test().author().id)
            requestFromAuthor = true;

        // Query includes private tests in case the test
        // belongs to the user. We check it manually here.
        // Author sent separate for extraction purposes
        // This code is critical for the website,
        // See ResultRoute
        var author = attempt.test().author();
        if (!requestFromAuthor) {
            author = author.minimalProfile();
        }

        response.success({attempt: attempt, author: author});
    }, function (error) {
        response.error(error);
    });
});

/**
 * @Deprecated
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

    Parse.Cloud.useMasterKey();
    Parse.Object.saveAll(responses).then(function () {
        var promises = [];
        // Add responses to attempt payload
        JSONAttempt.responses = responses;
        // Convert attempt payload to Parse Object and save
        attempt = Parse.Object.createFromJSON(JSONAttempt, 'Attempt');
        promises.push(attempt.save());

        // Basic Stat Update, user will be saved in .addUniqueResponses function
        // (unique stats done on TaskWorker)
        user.increment('numberOfAttempts');

        // Create or update uniqueResponses, user saved in here
        promises.push(user.addUniqueResponses(responses));

        promises.push(UserEvent.newEvent("finishedQuiz", [attempt], user));

        return Parse.Promise.when(promises);
    }).then(function (attempt, uniqueResponses, userEvent) {
        status.success({
            attempt: attempt, uniqueResponses: uniqueResponses,
            userEvent: userEvent
        });
    }, function (error) {
        status.error(error);
    });
});

/**
 * @CloudFunction Finalise New Attempt
 * Call after attempt has already been
 * saved.
 *
 * This function creates uniqueResponses
 * AND handles gamification.
 *
 * @param {String} attemptId
 * @return {{attempt: Attempt, userEvent: UserEvent, uniqueResponses: uniqueResponses}}
 */
Parse.Cloud.define('finaliseNewAttempt', function (request, status) {
    var user = request.user,
        attempt,
        attemptId = request.params.attemptId,
        attemptQuery = new Parse.Query(Attempt);

    attemptQuery.include('responses');

    Parse.Cloud.useMasterKey(); // needed to get author
    // need author to notify of new activity
    attemptQuery.include('test.author');
    attemptQuery.get(attemptId).then(function (result) {
        attempt = result;
        var promises = [];

        // Basic Stat Update, user will be saved in .addUniqueResponses function
        // (unique stats done on TaskWorker)
        user.increment('numberOfAttempts');
        if (user.get('averageScore') > 0 || attempt.score() > 0) {
            var newAverage = Math.round((user.get('averageScore') + attempt.score()) /
                user.get('numberOfAttempts'));
            user.set('averageScore', newAverage);
        }

        // Create or update uniqueResponses, user saved in here
        promises.push(user.addUniqueResponses(attempt.responses()));

        promises.push(UserEvent.newEvent("finishedQuiz", [attempt], user));

        promises.push(addActivityToStream(user, "took quiz", attempt, [attempt.test().author()], attempt.test()));

        return Parse.Promise.when(promises);
    }).then(function (uniqueResponses, userEvent) {
        status.success({
            attempt: attempt,
            uniqueResponses: uniqueResponses,
            userEvent: userEvent,
            user: user
        });
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
 * @param {boolean} isTaskToAdd OR add
 * @param {string} childObjectClass
 * @param {Array} childObjectIds
 * @return success/error
 */
Parse.Cloud.define('addOrRemoveRelation', function (request, response) {
    var parentObjectClass = request.params.parentObjectClass,
        parentObjectId = request.params.parentObjectId,
        parentObject = new Parse.Object(parentObjectClass),
        relationKey = request.params.relationKey,
        isTaskToAdd = request.params.isTaskToAdd ? request.params.isTaskToAdd : request.params.add,
        childObjectClass = request.params.childObjectClass,
        childObjectIds = request.params.childObjectIds,
        promises = [];

    parentObject.id = parentObjectId;
    Parse.Cloud.useMasterKey();
    promises.push(parentObject.fetch());

    var query = new Parse.Query(childObjectClass);
    query.containedIn('objectId', childObjectIds);
    promises.push(query.find());

    Parse.Promise.when(promises).then(function (parentObject, childObjects) {
        var relation = parentObject.relation(relationKey);
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
                return institution.save(null, {useMasterKey: true});
            } else
                return institution;
        } else {
            institution = new Institution();
            institution.set('name', name);
            institution.set('type', type);
            if (facebookId)
                institution.set('facebookId', facebookId);
            var ACL = new Parse.ACL();
            ACL.setPublicReadAccess(true);
            institution.setACL(ACL);
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
                    return studyField.save(null, {useMasterKey: true});
                else
                    return studyField;
            } else {
                studyField = new StudyField();
                studyField.set('name', name);
                studyField.set('facebookId', facebookId);
                var ACL = new Parse.ACL();
                ACL.setPublicReadAccess(true);
                studyField.setACL(ACL);
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
    if (user.get('srIntensityLevel') === undefined)
        user.set('srIntensityLevel', 2);
    user.set('srNotifyByEmail', true);
    // TODO check if user has app.
    user.set('srNotifyByPush', false);
    user.set('srNextDue', moment().add(1, 'minute').toDate());

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
/**
 * @CloudFunction Send Beta Invite
 *
 * @return success/error
 */
Parse.Cloud.define("sendBetaInvite", function (request, response) {
    var promises = [];
    Parse.Cloud.useMasterKey();
    // Find people who haven't been invite yet
    var betaInviteQuery = new Parse.Query("BetaInvite");
    betaInviteQuery.notEqualTo("inviteSent", true);
    // // TODO Currently In Private Beta
    betaInviteQuery.equalTo('privateBeta', true);

    var allowedEmails = request.params.allowedEmails;

    var betaInvitesToSend = [];
    betaInviteQuery.find().then(function (betaInvites) {

        // Figure out who we want to invite
        _.each(betaInvites, function (betaInvite) {
            if (!allowedEmails || _.contains(allowedEmails, betaInvite.get('email')))
                betaInvitesToSend.push(betaInvite);

        });
        // Send invites
        _.each(betaInvitesToSend, function (betaInvite) {
            var firstName = betaInvite.get('firstName');
            if (!firstName)
                firstName = "there";

            var invitationLink = "https://synap.ac/activate-beta/" + betaInvite.id;

            promises.push(
                sendEmail("beta-invitation", betaInvite.get('email'), null,
                    [{name: "FNAME", content: firstName.capitalizeFirstLetter()},
                        {name: "INVITATIONLINK", content: invitationLink}]));

            // Set sent flag
            betaInvite.set('inviteSent', true);
            promises.push(betaInvite.save());
        });
        return Parse.Promise.when(promises);
    }).then(function () {
        response.success(betaInvitesToSend.length + " invites sent.")
    }, function (error) {
        response.error(error);
    });
});
/**
 * @CloudFunction Beta Invite Accepted
 *
 * @param {string} id (for BetaInvite class)
 * @return success/error
 */
Parse.Cloud.define("betaInviteAccepted", function (request, response) {
    var betaInviteId = request.params.id;
    if (!betaInviteId)
        return response.error("No beta invitation id sent.");

    Parse.Cloud.useMasterKey();
    // Find the invite
    var betaInviteQuery = new Parse.Query("BetaInvite");
    betaInviteQuery.equalTo("objectId", betaInviteId);

    betaInviteQuery.find().then(function (betaInvites) {
        var betaInvite = betaInvites[0];
        if (!betaInvite)
            response.error("No beta invitation with this id.");
        else if (!betaInvite.get('inviteSent'))
            response.error("You have not been invited to the Synap beta yet. Please hold tight!");

        else if (betaInvite.get('betaActivated') && betaInvite.get('user'))
            response.error("Woops! Looks like you've already activated your invitation!");
        else {
            betaInvite.set('betaActivated', true);
            return betaInvite.save();
        }
    }).then(function (betaInvite) {
        if (betaInvite)
            response.success({betaInvite: betaInvite});
    });
});
/**
 * @CloudFunction Check Beta Access
 *
 * @param {string} id (for BetaInvite class)
 * @param {string} email
 * @return success/error
 */
Parse.Cloud.define("checkBetaAccess", function (request, response) {
    var betaInviteId = request.params.id,
        email = request.params.email;

    if (!betaInviteId && !email)
        return response.error("No beta invitation id/email sent.");

    Parse.Cloud.useMasterKey();
    // Find the invite
    var betaInviteQuery = new Parse.Query("BetaInvite");
    if (email)
        betaInviteQuery.equalTo("email", email);
    else if (betaInviteId)
        betaInviteQuery.equalTo("objectId", betaInviteId);

    betaInviteQuery.find().then(function (betaInvites) {
        var betaInvite = betaInvites[0];
        if (!betaInvite || !betaInvite.get('inviteSent'))
            response.error("You are not invited to the beta yet.");
        else if (!betaInvite.get('betaActivated'))
            response.error("You have not activated your beta invited yet! Check your email.");
        else {
            if (email && betaInvite.get('email') !== email) {
                betaInvite.set('email', email); // Likely that the user used a different email to sign up.
                betaInvite.save().then(function () {
                    response.success({betaInvite: betaInvite});
                });
            } else
                response.success({betaInvite: betaInvite});
        }
    });
});

/**
 * @CloudFunction Get Hot Tests
 * Used to find up and coming tests for Browse Page.
 *
 * @return {hotTests: [Test]}
 */
Parse.Cloud.define('getHotTests', function (request, response) {
    var hotTestsQuery = new Parse.Query(Test);

    // TODO enable creation date to get hot new tests
    //hotTestsQuery.greaterThan('createdAt', moment().subtract(20, 'weeks').toDate());

    hotTestsQuery.descending('numberOfAttempts');
    hotTestsQuery.notEqualTo('isGenerated', true);
    hotTestsQuery.equalTo('isPublic', true);
    hotTestsQuery.limit(3);
    // Needed for author fetching
    Parse.Cloud.useMasterKey();
    hotTestsQuery.include('author');
    hotTestsQuery.find().then(function (tests) {
        response.success({hotTests: Test.minifyAuthorProfiles(tests)});
    }, function (error) {
        response.error(error);
    });
});

/**
 * @CloudFunction Get User Profile
 * User profiles are private objects:
 * this fetches them and removes
 * sensitive info before returning.
 * @param {String} slug
 * @param {String} objectId
 * @param {boolean} includeTests
 * @return {Parse.User}
 */
Parse.Cloud.define('getUserProfile', function (request, response) {
    Parse.Cloud.useMasterKey();

    var slug = request.params.slug,
        objectId = request.params.objectId,
        includeTests = request.params.includeTests,
        createdTests,
        includeFollow = request.params.includeFollow,
        followers,
        following,
        user;

    var userQuery = new Parse.Query(Parse.User);

    if (slug)
        userQuery.equalTo('slug', slug);
    if (objectId)
        userQuery.equalTo('objectId', objectId);

    userQuery.include('educationCohort.studyField', 'educationCohort.institution');
    userQuery.include('badgeProgressions.badge');

    userQuery.find().then(function (results) {
        user = results[0];
        if (!user)
            return response.error("User with this slug or id not found.");

        var promises = [];

        if (includeTests) {
            var createdTestsQuery = user.createdTests().query();
            createdTestsQuery.limit(1000);
            createdTestsQuery.ascending('title');
            createdTestsQuery.notEqualTo('isObjectDeleted', true);
            createdTestsQuery.equalTo('isPublic', true);
            createdTestsQuery.notEqualTo('isGenerated', true);
            promises.push(createdTests = createdTestsQuery.find());
        }
        if (includeFollow) {
            var followingQuery = user.following().query();
            followingQuery.limit(10);
            promises.push(following = followingQuery.find());

            var followersQuery = user.followers().query();
            followersQuery.limit(10);
            promises.push(followers = followersQuery.find());
        }
        return Parse.Promise.when(promises);
    }).then(function () {
        var userMiniProfile = user.minimalProfile();

        if (createdTests && (createdTests = createdTests["_result"][0]))
            userMiniProfile.createdTests = createdTests;

        if (following && (following = following["_result"][0])) {
            var followingMinimalProfiles = [];
            _.each(following, function (followee) {
                followingMinimalProfiles.push(followee.minimalProfile());
            });
            userMiniProfile.following = followingMinimalProfiles;
        }

        if (followers && (followers = followers["_result"][0])) {
            var followersMinimalProfiles = [];
            _.each(followers, function (follower) {
                followersMinimalProfiles.push(follower.minimalProfile());
            });
            userMiniProfile.followers = followersMinimalProfiles;
        }

        response.success(userMiniProfile);
    }, function (error) {
        response.error(error);
    });
});

/**
 * @CloudFunction Follow User
 *
 * Adds user to current user in the 'following'
 * relation, increments currentUser's
 * numberFollowing. Updates relation and
 * numberOfFollowers for the recipient
 * user too - plus sends a push notification
 * to them.
 *
 * @param {String} userIdToFollow
 */
Parse.Cloud.define("followUser", function (request, response) {
    Parse.Cloud.useMasterKey();

    var currentUser = request.user,
        userToFollow = new Parse.User();

    if(request.params.currentUserId)  {
        currentUser = new Parse.User();
        currentUser.id = request.params.currentUserId;
    }

    if (!currentUser) {
        return response.error("You must be logged in.");
    }

    userToFollow.id = request.params.userIdToFollow;

    return userToFollow.fetch().then(function () {
        userToFollow.followers().add(currentUser);
        currentUser.following().add(userToFollow);
        return Parse.Promise.when([userToFollow.save(), currentUser.save()]);
    }).then(function () {
        // Fail safe to accurately count followers/following
        // Can't just increment in case the user was already followed/unfollowed
        var followerCountQuery = userToFollow.followers().query(),
            followingCountQuery = currentUser.following().query();

        // TODO this actually works, but need to implement on the app
        /*
         var pushNotification;
         var query = new Parse.Query(Parse.Installation);
         query.equalTo('user', userToFollow);
         pushNotification = Parse.Push.send({
         where: query,
         data: {
         alert: currentUser.get('name') + " started following you!",
         badge: "Increment",
         sound: "default.caf",
         title: "You have a new Synap Follower!",
         userId: currentUser.id,
         userName: currentUser.get('name'),
         pushType: "newFollower"
         }
         // TODO add promise to promises array when uncommented
         });*/

        return Parse.Promise.when([followerCountQuery.count(), followingCountQuery.count()]);
    }).then(function (followerCount, followingCount) {
        userToFollow.set('numberOfFollowers', followerCount);
        currentUser.set('numberFollowing', followingCount);
        return Parse.Promise.when([
            userToFollow.save(),
            currentUser.save(),
            Follow.followedUser(currentUser, userToFollow)
        ])
    }).then(function () {
        response.success();
    }, function (error) {
        response.error(error);
    });
});

/**
 * @CloudFunction Unfollow User
 *
 * Removes user from current user' 'following'
 * relation, decrements currentUser's
 * numberFollowing. Updates relation and
 * numberOfFollowers for the recipient
 * user too.
 *
 * @param {String} userIdToUnfollow
 */
Parse.Cloud.define("unfollowUser", function (request, response) {
    Parse.Cloud.useMasterKey();

    var currentUser = request.user,
        userToUnfollow = new Parse.User();

    if (!currentUser) {
        return response.error("You must be logged in.");
    }

    userToUnfollow.id = request.params.userIdToUnfollow;

    return userToUnfollow.fetch().then(function () {
        userToUnfollow.followers().remove(currentUser);
        currentUser.following().remove(userToUnfollow);
        return Parse.Promise.when([userToUnfollow.save(), currentUser.save()]);
    }).then(function () {
        // Fail safe to accurately count followers/following
        // Can't just increment in case the user was already followed/unfollowed
        var followerCountQuery = userToUnfollow.followers().query(),
            followingCountQuery = currentUser.following().query();

        return Parse.Promise.when([followerCountQuery.count(), followingCountQuery.count()]);
    }).then(function (followerCount, followingCount) {
        userToUnfollow.set('numberOfFollowers', followerCount);
        currentUser.set('numberFollowing', followingCount);

        return Parse.Promise.when([
            userToUnfollow.save(),
            currentUser.save(),
            Follow.unfollowedUser(currentUser, userToUnfollow)]);
    }).then(function () {
        response.success();
    }, function (error) {
        response.error(error);
    });
});

/**
 * @CloudFunction Perform Search
 * Manipulates search results to fetch latest
 * author data.
 * {String} indexName
 * {string} searchTerm
 * {Object} options
 * {Object} multipleQueries
 * @return {Object} searchResults
 */
Parse.Cloud.define('performSearch', function (request, response) {
    Parse.Cloud.useMasterKey();
    var indexName = request.params.indexName,
        searchTerm = request.params.searchTerm,
        options = request.params.options,
        multipleQueries = request.params.multipleQueries,
        searchResults;

    var searchPromise;
    if (multipleQueries) {
        searchPromise = algoliaClient.search(multipleQueries);
    } else {
        searchPromise = algoliaClient.initIndex(indexName).search(searchTerm, options)
    }

    searchPromise.then(function (result) {
        searchResults = result;

        var tests;
        if (multipleQueries) {
            tests = searchResults.results[0];
        } else if (indexName.startsWith("Test"))
            tests = searchResults.hits;

        if (tests)
            return getAuthorsFromTestsSearch(tests);
    }).then(function (tests) {
        if (multipleQueries)
            searchResults.results[0] = tests;
        else if (indexName.startsWith("Test"))
            searchResults.hits = tests;

        response.success(searchResults);
    }, function (error) {
        response.error(error);
    });
});

/**
 * @CloudFunction Fetch Url Meta Data
 * Used for further reading feature on quiz questions
 * @param {String} url
 * @return {Object} metaData
 */
Parse.Cloud.define('fetchUrlMetaData', function (request, response) {
    var url = request.params.url;

    Parse.Cloud.httpRequest({url: url}).then(function (httpResponse) {
        var stringHtml = httpResponse.text,
            $ = cheerio.load(stringHtml),
            title = $("meta[property='og:title']").attr("content"),
            description = $("meta[name='description']").attr("content"),
            image = $("meta[property='og:image']").attr("content");

        if (!title)
            title = $('head > title').text();
        var metaData = {
            title: title,
            description: description,
            image: image,
            url: url
        };

        response.success(metaData);
    }, function (error) {
        response.error(error);
    });
});

Parse.Cloud.define('preFacebookSignUp', function (request, response) {
    Parse.Cloud.useMasterKey();

    var data = request.params.data,
        promise;

    var userQuery = new Parse.Query(Parse.User);
    userQuery.equalTo('username', data.email);
    userQuery.doesNotExist('authData');
    promise = userQuery.find().then(function (result) {
        var user = result[0];
        if (user) {
            user.set('authData', data.authData);
            return user.save();
        }
    });

    promise.then(function () {
        response.success();
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
    dailyRecap: dailyRecapTask,
    updateTestStatsAfterAttempt: updateTestStatsAfterAttemptTask
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
    logger.log("spaced-repetition", "task started at " + moment().tz("Europe/London").format("h:mm a, Do MMM YYYY"));
    Parse.Cloud.useMasterKey();
    var initialPromises = [],
        testsGenerated = 0;

    // Config needed to determine memory thresholds
    initialPromises.push(Parse.Config.get());
    // Query activated users
    var queryForUsers = new Parse.Query(Parse.User);
    // Don't want to generate more until last test is taken or dismissed
    queryForUsers.equalTo("srLatestTestIsTaken", true);

    var queryForUsersTwo = new Parse.Query(Parse.User);
    // Don't want to generate more until last test is taken or dismissed
    queryForUsersTwo.equalTo("srLatestTestDismissed", true);

    var mainQueryForUsers = Parse.Query.or(queryForUsers, queryForUsersTwo);
    mainQueryForUsers.equalTo('srActivated', true);
    mainQueryForUsers.lessThanOrEqualTo('srNextDue', new Date());
    mainQueryForUsers.include('educationCohort');
    mainQueryForUsers.limit(100);

    initialPromises.push(mainQueryForUsers.find());

    // Loop through users with SR activated and SR due time in the past
    return Parse.Promise.when(initialPromises).then(function (config, users) {
        logger.log("spaced-repetition", "number of users for this task: " + users.length);
        // Spaced Repetition Category for all SR tests
        var spacedRepetitionCategory = new Category();
        spacedRepetitionCategory.id = config.get('srCategoryId');
        // Per user, we create a promise, and resolve for all before
        // setting this task as complete.
        var perUserPromises = [];
        _.each(users, function (user) {
            logger.log("spaced-repetition", "current loop for: " + user.name() + " (" + user.id + ")");
            // SR Intensity Level for User
            var srIntensityLevel = _.where(config.get('srIntensityLevels'), {level: user.get('srIntensityLevel')})[0],
                urRelation = user.uniqueResponses(),
                urQuery = urRelation.query();
            // Find URs below the user's SR intensity threshold
            logger.log("spaced-repetition", "srIntensity upper limit: " + srIntensityLevel.upperLimit,
                srIntensityLevel);

            urQuery.lessThanOrEqualTo('memoryStrength', srIntensityLevel.upperLimit);
            urQuery.ascending('memoryStrength');
            // Max 30 questions per test (intensity level based)
            // But we shuffle the lowest 60 to be unpredictable
            urQuery.limit(1000);
            urQuery.include('question');


            // Get current time based on User's timeZone
            var timeZone = user.get('timeZone'),
                now = moment().tz(timeZone);

            // scheduleSlotForSR contains the *slot* and the exact *time* (Moment)
            // at which this test will be sent to the user.
            var scheduleForSR = findNextAvailableSlotForSR(now, config.get('srDailySlots'),
                user.srDoNotDisturbTimes());

            var srNextDue;
            if (scheduleForSR.time.diff(now, 'm') <= 5) {
                logger.log("spaced-repetition", user.name() + " time for SR yet");
                // It is close enough to the scheduled slot, proceed with loop
                // But set next due a bit later for the next slot (needs recoding)
                srNextDue = _.clone(scheduleForSR.time).add(2, 'hours');
                user.set('srNextDue', srNextDue.toDate());
                // will be saved in the inner promise.
            } else {
                logger.log("spaced-repetition", user.name() + " not schedule for SR yet");
                // Not time for SR, schedule next loop for five mins before next slot
                srNextDue = _.clone(scheduleForSR.time).subtract(5, 'min');
                user.set('srNextDue', srNextDue.toDate());
                perUserPromises.push(user.save());
                return; // End of loop for user
            }

            // Begin by getting URs and updating their memory strengths
            var perUserPromise =
                UniqueResponse.findWithUpdatedMemoryStrengths(urQuery).then(function (uniqueResponses) {
                    if (!uniqueResponses.length) {
                        return null;
                    }
                    logger.log("spaced-repetition", "number of URs found: " + uniqueResponses.length, user.name());
                    // Generate the SR test
                    var test = new Test();
                    test.set('isGenerated', true);
                    test.set('isSpacedRepetition', true);
                    test.set('isPublic', false);
                    test.setAuthor(user);
                    test.set('category', spacedRepetitionCategory);
                    var daysOfTheWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
                        title = daysOfTheWeek[scheduleForSR.time.day()];
                    title += " " + scheduleForSR.slot.label.camelCaseToNormal() + " Quiz";
                    var humanDate = scheduleForSR.time.format("Do of MMMM, YYYY");
                    test.set('description', "This quiz was generated and sent to you on " + humanDate);
                    test.set('title', title);
                    test.set('slug', user.get('slug') +
                        "-" + scheduleForSR.time.daysInMonth() + "-" + scheduleForSR.time.month() + "-" +
                        scheduleForSR.time.year() + "-" + scheduleForSR.slot.label);

                    var questions = [],
                        testTags = [],
                        totalDifficulty = 0;

                    // Though we want mostly questions with the user's lowest memoryStrengths,
                    // we don't want to be completely linear and predictable.
                    // By shuffling the lowest ~60, and then taking the first [maxQuestions],
                    // we have a good mix of UR memoryStrengths.
                    var shuffledURs = _.shuffle(uniqueResponses);

                    // Get Module tags (either from user or their education cohort)
                    var moduleTags = []; // empty array to avoid breaking first loop
                    if (user.moduleTags())
                        moduleTags = user.moduleTags();
                    else if (user.educationCohort() && user.educationCohort().moduleTags())
                        moduleTags = user.educationCohort().moduleTags();

                    // First loop, only add questions that match moduleTags
                    _.each(shuffledURs, function (uniqueResponse) {
                        if (questions.length < srIntensityLevel.maxQuestions) {

                            var question = uniqueResponse.question();

                            if (_.contains(moduleTags, question.tags())) {
                                questions.push(uniqueResponse.get('question'));
                                totalDifficulty += uniqueResponse.question().difficulty();

                                _.each(question.get('tags'), function (tag) {
                                    if (!_.contains(testTags, tag))
                                        testTags.push(tag);
                                });
                            }
                        }
                    });

                    // Second loop, add other URs if space
                    _.each(shuffledURs, function (uniqueResponse) {
                        if (questions.length < srIntensityLevel.maxQuestions) {

                            var question = uniqueResponse.question();
                            questions.push(question);

                            totalDifficulty += uniqueResponse.question().difficulty();

                            _.each(question.tags(), function (tag) {
                                if (!_.contains(testTags, tag))
                                    testTags.push(tag);
                            });
                        }
                    });

                    test.set('questions', questions);
                    test.set('totalQuestions', questions.length);
                    test.set('difficulty', Math.round(totalDifficulty / test.totalQuestions()));
                    logger.log("spaced-repetition", "number of questions: " + questions.length);
                    test.set('tags', testTags);
                    return test.save();
                }).then(function (test) {
                    if (!test)
                        return;
                    user.set('srLatestTest', test);
                    user.set('srLatestTestDismissed', false);
                    user.set('srLatestTestIsTaken', false);
                    logger.log("spaced-repetition", "test successfully generated: " + test.id);
                    user.srAllTests().add(test);
                    testsGenerated++;

                    // Save user and create a task for the user to be notified
                    // upon schedule.
                    var innerPromises = [];
                    innerPromises.push(user.save());

                    logger.log("spaced-repetition", user.name() + " wants an email? " + user.srNotifyByEmail());
                    if (user.srNotifyByEmail()) {
                        innerPromises.push(sendEmail("spaced-repetition",
                            user.email(), user, [
                                {"name": "TEST_TITLE", content: test.title()},
                                {name: "TEST_LINK", content: APP.baseUrl + APP.testInfo + test.slug()},
                                {name: "NUM_QUESTIONS", content: test.totalQuestions()},
                                {
                                    name: "TAGS",
                                    content: test.tags().length ? test.tags().humanize() : "a range of areas"
                                }
                            ]));
                    }

                    return Parse.Promise.when(innerPromises);
                });
            perUserPromises.push(perUserPromise);
        });
        return Parse.Promise.when(perUserPromises);
    }).then(function () {
        // Set next SR cycle time to 5 minutes from now.
        var changes = {
            taskStatus: 'done',
            taskMessage: testsGenerated + ' test(s) generated.',
            taskClaimed: 0, // repetitive task, do not destroy
            scheduledTime: moment().add(5, 'minutes').toDate()
        };
        return task.save(changes, {useMasterKey: true});
    }, function (error) {
        console.error(JSON.stringify(error));
        logger.log("Spaced Repetition Cycle", "error", error);
    });
}

/**
 * @Task Daily Recap
 * Every 60 minutes, this task loops
 * through each user, showing them
 * what they did the day before,
 * and stats on their tests.
 *
 * This task is self cycling.
 * @param {String} task
 * @returns {WorkTask}
 */
function dailyRecapTask(task) {
    Parse.Cloud.useMasterKey();
    var initialPromises = [],
        recapsGenerated = 0;

    // Config needed to determine memory thresholds
    initialPromises.push(Parse.Config.get());

    var mainQueryForUsers = new Parse.Query(Parse.User);
    mainQueryForUsers.limit(1000);
    mainQueryForUsers.equalTo("name", "Omair Vaiyani");

    initialPromises.push(mainQueryForUsers.find());

    // Loop through users with SR activated and SR due time in the past
    return Parse.Promise.when(initialPromises).then(function (config, users) {
        var perUserPromises = [];
        _.each(users, function (user) {

            var now = moment().tz(user.timeZone());

            // Only send out recap at 9pm.
            if(now.hour() !== 9)
                return;

            var createdTestsQuery = user.createdTests().query(),
                attemptsOnCreatedTests = new Parse.Query(Attempt);

            attemptsOnCreatedTests.matchesQuery('test', createdTestsQuery);
            attemptsOnCreatedTests.notEqualTo('user', user);
            attemptsOnCreatedTests.include('test', 'user');
            attemptsOnCreatedTests.limit(1000);

            var perUserPromise = attemptsOnCreatedTests.find().then(function (attempts) {

                var totalAttemptsOnCreatedTests = attempts.length;

                return sendEmail('daily-recap', user.email(), user, [
                    {name: "TOTAL_ATTEMPTS_ON_CREATED_TESTS", content: totalAttemptsOnCreatedTests}
                ]);
            });

            perUserPromises.push(perUserPromise);
        });

        return Parse.Promise.when(perUserPromises);
    }).then(function () {
        // Set next SR cycle time to 5 minutes from now.
        var changes = {
            taskStatus: 'done',
            taskMessage: recapsGenerated + ' recaps(s) generated.',
            taskClaimed: 0, // repetitive task, do not destroy
            scheduledTime: moment().add(60, 'minutes').toDate()
        };
        return task.save(changes, {useMasterKey: true});
    }, function (error) {
        console.error(JSON.stringify(error));
        logger.log("Daily Recap Cycle", "error", error);
    });
}

/**
 * @Task Update Test Stats After Attempt
 *
 * Set on Attempt.afterSave
 *
 * @param task
 * @param params
 * @param objects
 * @returns {*}
 */
function updateTestStatsAfterAttemptTask(task, params, objects) {
    Parse.Cloud.useMasterKey();
    var test = objects[0],
        questionPointers = objects[1],
        attempt = objects[2],
        user = objects[3],
        questionQuery = new Parse.Query(Question);

    questionQuery.containedIn("objectId", _.map(questionPointers, function (questionPointer) {
        return questionPointer.id;
    }));

    return questionQuery.find().then(function (questions) {

        test.increment('numberOfAttempts');

        // The test.averageScore is not the average attempt score on the test,
        // rather, it's the tally of average correctness in its individual
        // questions - this allows flexibility should the questions be moved
        // between tests.
        var questionPercentOfCorrectnessTally = 0,
            questionPercentOfUniqueCorrectnessTally = 0,
            numberOfUniqueResponsesTally = 0,
            totalDifficulty = 0;

        _.each(questions, function (question) {
            questionPercentOfCorrectnessTally += question.percentOfCorrectResponses();
            questionPercentOfUniqueCorrectnessTally += question.percentOfCorrectUniqueResponses();
            numberOfUniqueResponsesTally += question.numberOfUniqueResponses();
            totalDifficulty += question.difficulty();
        });

        test.set('averageScore', Math.round(questionPercentOfCorrectnessTally / questions.length));

        // Similarly, test.averageUniqueScore is based upon that of its questions
        // NOTE, it does not matter if this current attempt is unique or not.
        // We are simply updating the test attributes with the real info from the questions.
        test.set('averageUniqueScore', Math.round(questionPercentOfUniqueCorrectnessTally / questions.length));

        // Following from what is mentioned above, we can take the average of the
        // questions.@each.numberOfUniqueResponses to set the tests.numberOfUniqueResponses.
        test.set('numberOfUniqueAttempts', Math.round(numberOfUniqueResponsesTally / questions.length));

        // Average difficulty of questions. Default difficulty for each question is 50.
        test.set('difficulty', Math.round(totalDifficulty / questions.length));

        // MasterKey is needed due to the Test's ACLs, even request.user === author.
        return test.save(null, {useMasterKey: true});
    }).then(function () {
        // Prepare to update stats for test's author and user
        var author = test.get('author');

        var attemptsQuery = new Parse.Query(Attempt);
        attemptsQuery.equalTo('user', user);
        attemptsQuery.equalTo('test', test);
        attemptsQuery.ascending('createdAt');
        return Parse.Promise.when(author.fetch(), attemptsQuery.find());
    }).then(function (author, previousAttempts) {
        // Update Author
        if (author.id !== user.id)
            author.increment('numberOfAttemptsByCommunity');

        // Update Author and User for Unique Attempt
        // Normal attempt count updated more immediately in
        // the first cloud function for attempt generation
        var isUnique = previousAttempts[0] && previousAttempts[0].id === attempt.id;
        if (isUnique) {
            if (author.id !== user.id)
                author.increment('numberOfUniqueAttemptsByCommunity');
            user.increment('numberOfUniqueAttempts');
        }

        return Parse.Promise.when(author.save(null, {useMasterKey: true}), user.save(null, {useMasterKey: true}));
    }).then(function () {
        var changes = {
            'taskStatus': 'done',
            'taskMessage': '',
            'taskClaimed': 1
        };
        return task.save(changes, {useMasterKey: true});
    }, function (error) {
        console.error(JSON.stringify(error));
    });
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
    if (!task.get('scheduledTime'))
        return true;

    var now = moment(),
        scheduledTime = moment(task.get('scheduledTime'));

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
});/*
 * ACTIVITY STREAM
 */
/**
 * @Function Add Activity to Stream
 * @param {Parse.User} actor
 * @param {String} verb
 * @param {Parse.Object} object
 * @param {Array<Parse.User>} to
 * @param {Parse.Object} target
 * @returns {*}
 */
function addActivityToStream(actor, verb, object, to, target) {
    // trigger fanout
    var activity = GetstreamUtils.parseToActivity({
        actor: actor,
        verb: verb,
        object: object,
        to: to,
        target: target
    });

    logger.log("activity-stream", "activity to be fed", activity);

    var feed = GetstreamClient.feed(activity.feed_slug, activity.feed_user_id);

    return feed.addActivity(activity, GetstreamUtils.createHandler(logger));
}

/**
 * @Function Prepare Activity for Dispatch
 *
 * - Minimised any non-self user profiles
 * - Creates a useful title for display
 * - Sets a flag on activities without the
 *   necessary parse objects, so that
 *   they can be deleted by the Cloud
 *   Function which called this function.
 *
 * @param {Object} activity
 * @param {Parse.User} currentUser
 * @returns {Object} activity
 */
function prepareActivityForDispatch(activity, currentUser) {
    // Minimise actor if not current user
    activity.actor = activity.actor.minimalProfile(currentUser);

    // Activity title
    var title = activity.actor.name;

    switch (activity.verb) {
        case "took quiz":
            var test = activity.target_parse;
            if (!test) {
                activity.shouldBeRemoved = true;
                return activity;
            }
            activity.target = test;
            title += " took " + test.title();
            break;
        case "followed":
            var following = activity.target_parse;
            if (!following || (currentUser.id === following.id)) {
                activity.shouldBeRemoved = true;
                return activity;
            }
            activity.target = following.minimalProfile(currentUser);
            title += " started following " + following.name;
            break;
    }
    activity.title = title;
    return activity;
}

/**
 * @Function Prepare Grouped Activity for Dispatch
 * @param {Array} groupedActivity
 * @param {Parse.User} currentUser
 * @return {Array} groupedActivities
 */
function prepareGroupedActivityForDispatch(groupedActivity, currentUser) {
    _.each(groupedActivity.activities, function (activity) {
        prepareActivityForDispatch(activity, currentUser);
    });
}

/*
 * View to retrieve the feed, expects feed in the format user:1
 * Accepts params
 *
 * feed: the feed id in the format user:1
 * limit: how many activities to get
 * id_lte: filter by activity id less than or equal to (for pagination)
 *
 */
Parse.Cloud.define("fetchActivityFeed", function (request, response) {
    var feedIdentifier = request.params.feed;
    var feedParts = feedIdentifier.split(':');
    var feedSlug = feedParts[0];
    var userId = feedParts[1];
    var id_lte = request.params.id_lte || undefined;
    var limit = request.params.limit || 100;
    var params = {
        limit: limit
    };
    if (id_lte) {
        params.id_lte = limit;
    }
    // initialize the feed class
    var feed = GetstreamClient.feed(feedSlug, userId);
    logger.log("activity-stream", "fetching feed", feed);
    Parse.Cloud.useMasterKey();
    feed.get(params, function (httpResponse) {
        var activities = httpResponse.data.results,
            unread = httpResponse.data.unread,
            unseen = httpResponse.data.unseen;
        logger.log("activity-stream", "feed data", httpResponse.data);

        var preparedActivities = [];
        return Parse.Cloud.run('enrichActivityStream', {activities: activities, user: request.user.toJSON()})
            .then(function (activities) {
                var removeActivitiesPromise = [];
                _.each(activities, function (activity) {
                    if (activity.shouldBeRemoved) {
                        removeActivitiesPromise.push(feed.removeActivity({
                            foreignId: activity.foreign_id
                        }, GetstreamUtils.createHandler(logger)))
                    } else {
                        preparedActivities.push(activity);
                    }
                });
                return Parse.Promise.when(removeActivitiesPromise);
            }).then(function () {
                response.success({
                    activities: preparedActivities,
                    feed: feedIdentifier,
                    token: feed.token,
                    unread: unread,
                    unseen: unseen
                });
            }, function (error) {
                response.error(error);
            });
    }, GetstreamUtils.createHandler(logger, response));
});

Parse.Cloud.define('enrichActivityStream', function (request, response) {
    var activities = request.params.activities,
        currentUser = request.user ? request.user : request.params.user;

    if (!currentUser)
        return response.error("You must send current user.");

    // enrich the response with the database values where needed

    var includes = {
        classNames: ["Test", "Follow"],
        Test: ["questions", "author"],
        Follow: ["following"]
    };
    Parse.Cloud.useMasterKey();
    return GetstreamUtils.enrich(activities, includes, currentUser).then(function (enrichedActivities) {

        // Prepare each activity (and inner activities for grouped feeds) for dispatch
        // Check each activity (and inner) if they need removing, set a remove flag
        _.each(enrichedActivities, function (activity) {
            if (activity.group)
                prepareGroupedActivityForDispatch(activity, currentUser);
            else
                prepareActivityForDispatch(activity, currentUser);
        });

        response.success(enrichedActivities);
    }, function (error) {
        response.error(error);
    });
});