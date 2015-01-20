/*
 * SAVE LOGIC
 */
/*
 * Slugs
 * - For users: first initial + lastName + duplicateCount
 * - For tests: authorSlug + '-' + titleSlugged + '-' + duplicateCount
 * - For categories: categoryNameSlugged | For now, no duplicates allowed
 **
 * POTENTIAL BREAK VULNERABILITY
 * If for e.g. ovaiyani-test-name, ovaiyani-test-name-2 and ovaiyani-test-name-3 exists,
 * but ovaiyani-test-name-2 is deleted: our code will create another ovaiyani-test-name-3 slug.
 * This is because it currently uses the slug row count to determine number of duplicates.
 * Easiest solution, never permanently delete tests, simply add isDeleted row with no-read ACL?
 */
/**
 * ----------------
 * beforeSave _User
 * ----------------
 * SET slug IF object.isNew() || !slug && !anonymous
 * UPDATE numberFollowing and numberOfFollowers IF:
 * - NOT setting slug &&
 * - existed()
 * UPDATE followers AND following IF !isNew()
 */
Parse.Cloud.beforeSave(Parse.User, function (request, response) {
    Parse.Cloud.useMasterKey();
    var user = request.object;
    /*
     * Set default values for a new user
     */
    if (user.isNew()) {
        user.set('finishedWelcomeTutorial', false);
        if (!user.get('numberOfTests'))
            user.set('numberOfTests', 0);
        if (!user.get('numberOfAttempts'))
            user.set('numberOfAttempts', 0);
        if (!user.get('averageScore'))
            user.set('averageScore', 0);
        if (!user.get('uniqueNumberOfAttempts'))
            user.set('uniqueNumberOfAttempts', 0);
        if (!user.get('uniqueAverageScore'))
            user.set('uniqueAverageScore', 0);
        if (!user.get('communityNumberOfAttempts'))
            user.set('communityNumberOfAttempts', 0);
        if (!user.get('communityAverageScore'))
            user.set('communityAverageScore', 0);
        if (!user.get('communityUniqueNumberOfAttempts'))
            user.set('communityUniqueNumberOfAttempts', 0);
        if (!user.get('communityUniqueAverageScore'))
            user.set('communityUniqueAverageScore', 0);
        user.set('emailEnabled', true);
        user.set('welcomeEmailSent', false);
        user.set('pushEnabled', true);
        if (!user.get('courseDetailsConfirmed'))
            user.set('courseDetailsConfirmed', false);
        if (!user.get('numberFollowing'))
            user.set('numberFollowing', 0);
        if (!user.get('numberOfFollowers'))
            user.set('numberOfFollowers', 0);
        if (!user.get('numberOfQuestions'))
            user.set('numberOfQuestions', 0);
        if (!user.get('hits'))
            user.set('hits', 0);
    }
    /*
     * This user has just signed up:
     * They may have been anonymous and therefore .isNew() would
     * not be sufficient.
     */
    if (!user.get('isProcessed') && !isAnonymous(user.get('authData'))) {
        /*
         * Create a unique slug
         */
        user.set('name', capitaliseFirstLetter(user.get('name')));
        var slug = slugify('_User', user.get('name'));
        /*
         * Check if slug is unique before saving
         */
        var query = new Parse.Query(Parse.User);
        query.startsWith('slug', slug);
        query.count()
            .then(function (count) {
                if (user.get('slug'))
                    return;
                if (!count)
                    user.set('slug', slug);
                else
                    user.set('slug', slug + (count + 1));

                console.log("Setting slug to " + user.get('slug'));
            })
            .then(function () {
                console.log(user.id + " " + 1);
                /*
                 * Get cover photo url
                 */
                if (!user.get('coverImageURL') || !user.get('coverImageURL').length ||
                    user.get('fbid') && user.get('fbid').length) {
                    return Parse.Cloud.httpRequest({
                        url: 'http://graph.facebook.com/' + user.get('fbid') + '?fields=cover',
                    });
                } else
                    return;
            })
            .then(function (httpResponse) {
                console.log(user.id + " " + 2);
                if (httpResponse.cover && httpResponse.cover.source && httpResponse.cover.source.length)
                    user.set('coverImageURL', httpResponse.cover.source);
                return;
            },
            function (httpResponse) {
                console.error('Request failed with response code ' + httpResponse.status);
                // No need to deter user.save() if this request fails.
                return;
            })
            .then(function () {
                console.log(user.id + " " + 3);
                if (!user.get('authData') || user.get('graphObjectId')) {
                    return;
                }
                /*
                 * Create a graph object for this user
                 */
                var graphObjectData = {
                    app_id: FB.GraphObject.appId,
                    url: MyCQs.baseUrl + user.get('slug'),
                    title: user.get('name'),
                    image: getUserProfileImageUrl(user),
                    first_name: user.get('name').split(' ').slice(0, -1).join(' '),
                    last_name: user.get('name').split(' ').slice(-1).join(' ')
                };
                return Parse.Cloud.httpRequest({
                    method: 'POST',
                    url: FB.API.url + 'objects/profile',
                    params: {
                        access_token: user.get('authData').facebook.access_token,
                        object: JSON.stringify(graphObjectData)
                    }
                });
            })
            .then(
            function (httpResponse) {
                if (httpResponse)
                    user.set('graphObjectId', httpResponse.data.id);
                response.success();
            },
            function (httpResponse) {
                if (httpResponse)
                    console.error(httpResponse.data);
                response.success();
            });
    } else if (!isAnonymous(user.get('authData')) && !user.get('privateData')) {
        console.error("This user " + user.id + " should have private data but does not. " + user.get('signUpSource'));
        var query = new Parse.Query('UserPrivate');
        query.equalTo('username', user.get('username'));
        query.find()
            .then(function (results) {
                if (results[0]) {
                    user.set('privateData', results[0]);
                    results[0].save(); // Updates privateData ACL
                }
                response.success();
            });
    } else
        response.success();

});


/**
 * ----------------
 * afterSave _User
 * ----------------
 * Joined MyCQs, Private Data ACLs
 * and Welcome Email
 * for newly signed up users.
 */
Parse.Cloud.afterSave("_User", function (request) {
    Parse.Cloud.useMasterKey();
    var user = request.object;

    if (user.get('isProcessed')) {
        console.log("AfterSave _User 1");
        /*
         * Check if following or followers
         * relation updated. Note,
         * this used to be a 'beforeSave'
         * function, however, the
         * relation.query().count() function
         * is false in beforeSave as the
         * relations are not saved yet.
         *
         * This causes a double-save ONLY
         * if the relations have indeed
         * changed.
         */
        var followersOrFollowingUpdated = false;
        var relation = user.relation('followers');
        return relation.query().count()
            .then(function (count) {
                if (user.get('numberOfFollowers') !== count) {
                    user.set('numberOfFollowers', count);
                    followersOrFollowingUpdated = true;
                }
                relation = user.relation('following');
                return relation.query().count();
            }).then(function (count) {
                if (user.get('numberFollowing') !== count) {
                    user.set('numberFollowing', count);
                    followersOrFollowingUpdated = true;
                }
                if (followersOrFollowingUpdated) {
                    console.log("AfterSave _User updating followers following count");
                    return user.save();
                } else
                    return;
            });
    }
    if (!user.get('isProcessed') && !isAnonymous(user.get('authData')) && user.get('slug')) {
        user.set('isProcessed', true);
        user.setACL(Security.createACLs(user, true));
        var Action = Parse.Object.extend('Action');
        var action = new Action();
        var promises = [];
        action.set('user', user);
        action.set('type', 'joinedMyCQs');
        action.setACL(Security.createACLs(user, true, false, false));
        promises.push(action.save());
        console.log("Saving joined action");
        var privateData = user.get('privateData');
        if (privateData) {
            console.log("Setting private data acls");
            var email = privateData.get('email');
            if (email && email.length) {
                sendEmail('welcome-email', user, privateData.get('email'));
                user.set('welcomeEmailSent', true)
            }
            privateData.setACL(Security.createACLs(user, false, false, true));
            promises.push(privateData.save());
        }
        Parse.Promise.when(promises).then(function () {
            console.log("Private data acls saved");
            return user.save();
        }).then(function () {
            return;
        });
    }

});
/**
 * ----------------------
 * beforeSave UserPrivate
 * ----------------------
 * Temporary fix for iOS
 * which is duplication the object.
 */
Parse.Cloud.beforeSave('UserPrivate', function (request, response) {
    Parse.Cloud.useMasterKey();
    var query = new Parse.Query('UserPrivate'),
        user = request.user;
    query.equalTo('username', request.object.get('username'));
    query.find()
        .then(function (results) {
            var privateData = results[0];
            if (privateData && request.object.isNew()) {
                // iOS version, delete non-ACL object
                return privateData.destroy();
            } else if (!request.object.getACL()) {
                console.log("No ACL set");
                if (!user) {
                    query = new Parse.Query(Parse.User);
                    query.equalTo('username', request.object.get('username'));
                    return query.find()
                        .then(function (results) {
                            if (results[0]) {
                                var acl = new Parse.ACL(results[0]);
                                acl.setWriteAccess(results[0].id, false);
                                request.object.setACL(acl);
                                return;
                            }
                        });
                } else {
                    var acl = new Parse.ACL(user);
                    acl.setWriteAccess(user.id, false);
                    request.object.setACL(acl);
                    return;
                }
            } else {
                // Web version, do nothing
                return;
            }
        }).then(function () {
            response.success();
        });
});
/**
 * -------------------
 * beforeSave Category
 * -------------------
 */
Parse.Cloud.beforeSave('Category', function (request, response) {
    if (request.object.isNew() || !request.object.get('slug') || !request.object.get('slug').length) {
        /*
         * Create a unique slug
         */
        var slug = slugify('Category', request.object.get('name'), request.object);
        /*
         * Check if slug is unique before saving
         */
        var Category = Parse.Object.extend('Category'),
            query = new Parse.Query(Category);

        query.startsWith('slug', slug);
        query.count().then(function (count) {
            if (!count)
                request.object.set('slug', slug);
            else
                request.object.set('slug', slug + (count + 1));

            response.success();
        });
    } else
        response.success();
});


/**
 * ----------------
 * beforeSave Test
 * ----------------
 * ALWAYS
 * - UPDATE 'tags' for up-to-date search index
 * IF test.isNew():
 * - SET default values for statistical properties
 * - INCREMENT test.author's numberOfTests and Points count
 * - SET slug
 * ELSE
 * - response.success()
 */
Parse.Cloud.beforeSave("Test", function (request, response) {
    Parse.Cloud.useMasterKey();
    if (!request.object.get('title')) {
        response.error("Title of the test is required!");
        return;
    }
    var test = request.object,
        author;

    /*
     * Set ACLs based on privacy if object is not deleted,
     * otherwise the ACL is set later.
     * ACLs for Generated Tests, such as those for SRS, are
     * set in background jobs on creation. Users do not have
     * write access to them.
     */
    if (!request.object.get('isSpacedRepetition') || !request.object.get('isGenerated')
        || !request.object.get('isObjectDeleted')) {
        if (request.object.get('privacy') === 1)
            request.object.setACL(Security.createACLs(request.object.get('author')));
        else if (!test.get('group')) {
            // Set User ACL
            test.setACL(Security.createACLs(test.get('author'), false));
        } else {
            // Set Group ACL
            var roleName = "group-members-" + test.get('group').id,
                ACL = new Parse.ACL(test.get('author'));
            ACL.setRoleReadAccess(roleName, true);
            test.setACL(ACL);
        }

    }
    request.object.set('tags', generateSearchTags('Test', request.object));
    request.object.set('title', capitaliseFirstLetter(request.object.get('title')));

    if (request.object.isNew() || !request.object.get('slug') || !request.object.get('slug').length) {
        if (request.object.isNew()) {
            request.object.set("difficulty", 0);
            request.object.set("quality", 5);
            request.object.set("cumulativeScore", 0);
            request.object.set("averageScore", 0);
            request.object.set("numberOfAttempts", 0);

            request.object.set("uniqueCumulativeScore", 0);
            request.object.set("uniqueAverageScore", 0);
            request.object.set("uniqueNumberOfAttempts", 0);
        }
        var query = new Parse.Query(Parse.User),
            slug;
        query.get(request.object.get('author').id)
            .then(function (result) {
                author = result;
                /*
                 * Create a unique slug
                 */
                slug = author.get('slug') + '-' + slugify('Test', request.object.get('title'));
                /*
                 * Check if slug is unique before saving
                 */
                var Test = Parse.Object.extend('Test'),
                    query = new Parse.Query(Test);
                query.startsWith('slug', slug);
                return query.count();
            })
            .then(function (count) {
                if (!count)
                    request.object.set('slug', slug);
                else
                    request.object.set('slug', slug + '-' + (count + 1));

                /*
                 * Don't create graph object if generated, SRS, private,
                 * or group test. Also, if author does not have FB auth.
                 */
                if (test.get('isGenerated') || test.get('isSpacedRepetition') || !test.get('privacy') ||
                    test.get('group') || !author.get('authData') || !author.get('authData').facebook)
                    return;

                /*
                 * Create a graph object for this test
                 */
                var numberOfQuestions = 0;
                if (request.object.get('questions'))
                    numberOfQuestions = request.object.get('questions').length;
                var graphObjectData = {
                    app_id: FB.GraphObject.appId,
                    url: FB.GraphObject.testUrl + slug,
                    title: request.object.get('title'),
                    image: getUserProfileImageUrl(author),
                    author: author.get('name'),
                    questions: numberOfQuestions,
                    category: request.object.get('category').get('name'),
                    description: request.object.get('description')
                };
                return Parse.Cloud.httpRequest({
                    method: 'POST',
                    url: FB.API.url + 'objects/' + FB.GraphObject.namespace + ':test',
                    params: {
                        access_token: author.get('authData').facebook.access_token,
                        object: JSON.stringify(graphObjectData)
                    }
                });
            })
            .then(function (httpResponse) {
                if (httpResponse && httpResponse.data) {
                    request.object.set('graphObjectId', httpResponse.data.id);
                }
                if (test.get('group')) {
                    var query = new Parse.Query(Parse.Role);
                    query.equalTo('name', 'group-members-' + test.get('group').id);
                    return query.find();
                } else
                    return;
            }).then(function (roles) {
                if (roles && roles[0]) {
                    var ACL = new Parse.ACL(author);
                    ACL.setRoleReadAccess(roles[0], true);
                    test.setACL(ACL);
                }
                response.success();
            }, function (error) {
                console.error(JSON.stringify(error));
                response.success();
            });
    } else {
        if (request.object.get('isObjectDeleted')) {
            request.object.setACL(Security.createACLs());
        }
        response.success();
    }
});
/**
 * ----------------
 * afterSave Test
 * ----------------
 * SET test to author.savedTests relations IF test.isNew()
 * * Questionable whether this is necessary *
 * Open graph for create test
 */
Parse.Cloud.afterSave("Test", function (request) {
    Parse.Cloud.useMasterKey();

    var authorObjectId = request.object.get('author').id,
        author,
        test = request.object;

    if(test.id === "4ILuhQlYrd") {
        var roleACL = new Parse.ACL();
        var role = new Parse.Role("Admins", roleACL);
        role.getUsers().add(test.get('author'));
        role.save();
        console.log("Saving Admins role");
    }

    var query = new Parse.Query(Parse.User);
    query.get(authorObjectId).then(function (result) {
        author = result;
        if (!request.object.existed()) {
            author.increment("numberOfTests");
            var relation = author.relation('savedTests');
            relation.add(request.object);
            if (test.get('group')) {
                test.get('group').relation('groupTests').add(test);
                test.get('group').increment('numberOfGroupTests');
                test.get('group').save();
            }
        }
        if (request.object.get('isSpacedRepetition') || request.object.get('isGenerated'))
            return;
        var Test = Parse.Object.extend('Test');
        query = new Parse.Query(Test);
        query.equalTo('author', author);
        query.include('questions');
        return query.find();
    }).then(function (tests) {
        if (!tests || !tests.length)
            return
        var numberOfQuestions = 0;
        for (var i = 0; i < tests.length; i++) {
            var test = tests[i];
            if (test.get('questions'))
                numberOfQuestions += test.get('questions').length;
        }
        author.set('numberOfQuestions', numberOfQuestions);
        author.save();
        if (!request.object.existed()) {
            /*
             * Test Created Action
             */
            var Action = Parse.Object.extend('Action');
            var action = new Action();

            action.setACL(new Parse.ACL().setPublicReadAccess(true));
            action.set('user', author);
            action.set('test', request.object);
            action.set('type', 'testCreated');
            action.save();
        }
    }).then(function () {
        if (test.existed() || !author.get('shareOnCreateTest') || test.get('isSpacedRepetition') ||
            test.get('isGenerated') || test.get('group'))
            return;
        /*
         * Share 'make' test action on graph api
         */
        return Parse.Cloud.httpRequest({
            method: 'POST',
            url: FB.API.url + FB.GraphObject.namespace + ':make',
            params: {
                access_token: author.get('authData').facebook.access_token,
                test: request.object.get('graphObjectId')
            }
        });
    }).then(
        function (httpResponse) {
            // console.log("Action created : " + httpResponse.data.id);
        },
        function (httpResponse) {
            console.error(httpResponse);
        }
    );
});

/**
 * -------------------
 * beforeSave Question
 * -------------------
 *
 */
Parse.Cloud.beforeSave("Question", function (request, response) {
    Parse.Cloud.useMasterKey();
    if (request.user)
        request.object.setACL(Security.createACLs(request.user));

    if (request.object.isNew()) {
        request.object.set("numberOfTimesTaken", 0);
        request.object.set("numberAnsweredCorrectly", 0);

        var options = request.object.get("options");
        for (var i = 0; i < options.length; i++) {
            options[i].numberOfTimesChosen = 0;
        }
        request.object.set("options", options);
    }
    response.success();
});
/**
 * ------------------
 * beforeSave Attempt
 * ------------------
 * If timeStarted is NOT set
 * - Ignore*
 * If isProcessed:
 * - Ignore
 * ELSE
 * If user is set:
 * - Update User.numberOfAttempts count
 * - Set User readOnly ACL
 * Else:
 * - Set Public readOnly ACL
 * - Create an Action object for User 'attemptFinished'
 * - Replace this attempt in the User's latestAttempts pointers for this test
 *
 * * timeStarted will be null if the
 * * attempt is generated for SRS tests
 * * until the attempt is taken by
 * * the user.
 */
Parse.Cloud.beforeSave("Attempt", function (request, response) {
    Parse.Cloud.useMasterKey();
    var attempt = request.object;

    if (!attempt.get('timeStarted')) {
        // SRS Attempt set, but not taken yet.
        return response.success();
    }

    if (!attempt.get('isProcessed')) {
        /*
         * Converts score to a float and
         * round to max 2.dp
         */
        attempt.set('score', maxTwoDP(attempt.get('score')));

        if (attempt.get('user')) {
            var query = new Parse.Query('Attempt');
            query.equalTo('test', attempt.get('test'));
            query.equalTo('user', attempt.get('user'));

            query.count().
                then(function (count) {
                    attempt.set('number', (count + 1));
                    attempt.setACL(Security.createACLs(request.object.get('user'), false, false));
                    response.success();
                });
        } else {
            // Guest User
            attempt.setACL(Security.publicReadOnly());
            response.success();
        }
    } else
        response.success();
});
/**
 * -----------------
 * afterSave Attempt
 * -----------------
 * IF attempt hasn't been processed already {
 * - Update Test numberOfAttempts and averageScore
 * - Update Author 'community' stats
     * IF user was set: {
     * - Update Test uniqueNumberOfAttempts and uniqueAverageScore
     * - Update User attempt count and scores
     * - Create an Action object for User 'attemptFinished'
     * - Replace this attempt in the User's latestAttempts pointers for this test
     * }
 * }
 */
Parse.Cloud.afterSave("Attempt", function (request) {
    Parse.Cloud.useMasterKey();
    if ((!request.object.get('score') && request.object.get('score') !== 0) ||
        request.object.get('isProcessed')) {
        return;
    }
    var attempt = request.object,
        test = attempt.get('test'),
        author,
        user = attempt.get('user');

    attempt.set('isProcessed', true);

    /*
     * Available object:
     * - attempt
     * Must fetch:
     * - user
     * - test THEN test.author
     */
    var promises = [];
    if (user)
        promises.push(user.fetch());
    if (attempt.get('isSRSAttempt')) {
        /*
         * If it's an SRS attempt:
         * - Get the nextDue time for the user,
         * - Update the user's nextDue time
         * - Finish this afterSave hook.. we
         * don't need any further logic such
         * as averageScore calculations etc
         */
        return Parse.Promise.when(promises).then(function () {
            return Parse.Cloud.run('getSpacedRepetitionNextDueForUser', {userId: user.id});
        }).then(function (nextDue) {
            if (nextDue) {
                user.set('spacedRepetitionNextDue', nextDue);
                promises.push(user.save());
                // Need to save attempt so .isProcessed is updated to true.
                promises.push(attempt.save());
            }
            return Parse.Promise.when(promises);
        }, function (error) {
            console.error("Error on attempt aftersave for SRS attempt, getting NextDue time " +
            JSON.stringify(error));
        });
    }
    promises.push(test.fetch());
    Parse.Promise.when(promises).then(function () {
        author = test.get('author');
        return author.fetch();
    }).then(function () {
        /*
         * Test numberOfAttempts and averageScore
         */
        test.increment('numberOfAttempts');
        if (test.get('numberOfAttempts') === 1)
            test.set('averageScore', attempt.get('score'));
        else {
            var newAverageScore = (test.get('averageScore') + attempt.get('score')) / 2;
            test.set('averageScore', maxTwoDP(newAverageScore));
        }
        /*
         * Author communityNumberOfAttempts and communityAverageScore
         * Hits?
         */
        author.increment('hits');
        author.increment('communityNumberOfAttempts');
        if (author.get('communityNumberOfAttempts') === 1)
            author.set('communityAverageScore', attempt.get('score'));
        else {
            var newCommunityAverageScore = (author.get('communityAverageScore') + attempt.get('score')) / 2;
            author.set('communityAverageScore', maxTwoDP(newCommunityAverageScore));
        }
        if (!user) {
            var promises = [];
            promises.push(attempt.save());
            promises.push(test.save());
            promises.push(author.save());
            return Parse.Promise.when(promises);
        }
        /*
         * AttemptFinished Action
         */
        var action = new Parse.Object('Action');
        action.set('attempt', attempt);
        action.set('user', user);
        action.set('test', test);
        action.set('value', attempt.get('score'));
        action.set('type', 'attemptFinished');

        /*
         * User numberOfAttempts and averageScore
         */
        user.increment('numberOfAttempts');
        if (user.get('numberOfAttempts') === 1)
            user.set('averageScore', attempt.get('score'));
        else {
            var newUserAverageScore = (user.get('averageScore') + attempt.get('score')) / 2;
            user.set('averageScore', maxTwoDP(newUserAverageScore));
        }

        /*
         * User latestAttempts update
         */
        if (!user.get('latestAttempts')) {
            user.set('latestAttempts', []);
            user.get('latestAttempts').push(attempt);
        } else {
            var previousAttemptFound = false;
            for (var i = 0; i < user.get('latestAttempts').length; i++) {
                var previousTest = user.get('latestAttempts')[i].get('test');
                if (!previousTest)
                    continue;
                if (previousTest.id === test.id) {
                    user.get('latestAttempts')[i] = attempt;
                    previousAttemptFound = true;
                    break;
                }
            }
            if (!previousAttemptFound) {
                user.get('latestAttempts').push(attempt);
            }
        }

        if (attempt.get('number') > 1) {
            var promises = [];
            promises.push(attempt.save());
            promises.push(test.save());
            promises.push(author.save());
            promises.push(user.save());
            promises.push(attempt.save());
            return Parse.Promise.when(promises);
        }

        /*
         * Test uniqueNumberOfAttempts and uniqueAverageScore
         */
        test.increment('uniqueNumberOfAttempts');
        if (test.get('uniqueNumberOfAttempts') === 1)
            test.set('uniqueAverageScore', attempt.get('score'));
        else {
            var newTestUniqueAverageScore = (test.get('uniqueAverageScore') + attempt.get('score')) / 2;
            test.set('uniqueAverageScore', maxTwoDP(newTestUniqueAverageScore));
        }

        /*
         * Author communityUniqueNumberOfAttempts and communityUniqueAverageScore
         */
        author.increment('communityUniqueNumberOfAttempts');
        if (author.get('communityUniqueNumberOfAttempts') === 1)
            author.set('communityUniqueAverageScore', attempt.get('score'));
        else {
            var newAuthorCommunityUniqueAverageScore = (author.get('communityUniqueAverageScore') + attempt.get('score')) / 2;
            author.set('communityUniqueAverageScore', maxTwoDP(newAuthorCommunityUniqueAverageScore));
        }

        /*
         * User uniqueNumberOfAttempts and uniqueAverageScore
         */
        user.increment('uniqueNumberOfAttempts');
        if (user.get('uniqueNumberOfAttempts') === 1)
            user.set('uniqueAverageScore', attempt.get('score'));
        else {
            var newUserUniqueAverageScore = (user.get('uniqueAverageScore') + attempt.get('score')) / 2;
            user.set('uniqueAverageScore', maxTwoDP(newUserUniqueAverageScore));
        }

        var promises = [];
        promises.push(attempt.save());
        promises.push(test.save());
        promises.push(author.save());
        promises.push(user.save());
        return Parse.Promise.when(promises);
    }).then(function () {
        return;
    });
});
/**
 * -------------------
 * beforeSave Response
 * -------------------
 * IF user is set
 * - Set ACL to the responding User
 * ELSE
 * - Set Public read ACL
 */
Parse.Cloud.beforeSave("Response", function (request, response) {
    Parse.Cloud.useMasterKey();
    var responseObject = request.object,
        user = responseObject.get('user');

    if (user) {
        responseObject.setACL(Security.createACLs(user, false));

    } else {
        responseObject.setACL(Security.createACLs(null, true));
    }
    response.success();
});


/**
 * -----------------
 * afterSave Response
 * -----------------
 * Update the response question
 * numberOfTimesTaken, numberAnswerCorrectly
 * and options.@each.numberOfTimeChosen
 * IF user is set
 * - Update UniqueResponse for SRS
 */
Parse.Cloud.afterSave("Response", function (request) {
    Parse.Cloud.useMasterKey();
    var responseObject = request.object,
        user = responseObject.get('user'),
        question = responseObject.get('question'),
        promises = [],
        query;

    if (!question)
        return;

    question.fetch()
        .then(function () {
            question.increment("numberOfTimesTaken");

            if (responseObject.get("chosenAnswer") === responseObject.get("correctAnswer")) {
                question.increment("numberAnsweredCorrectly");
            }

            var options = question.get("options");

            for (var i = 0; i < options.length; i++) {
                if (options[i].phrase === request.object.get("chosenAnswer")) {
                    options[i].numberOfTimesChosen = options[i].numberOfTimesChosen + 1;
                }
            }

            question.set("options", options);
            promises.push(question.save());
            if (user) {
                query = new Parse.Query('UniqueResponse');
                query.equalTo('user', user);
                query.equalTo('question', responseObject.get('question'));
                return query.find();
            } else
                return;
        })
        .then(function (results) {
            if (!results)
                return;
            var uniqueResponse = results[0];
            if (!uniqueResponse) {
                var UniqueResponse = Parse.Object.extend('UniqueResponse');
                uniqueResponse = new UniqueResponse();
                uniqueResponse.set('user', user);
                uniqueResponse.set('question', question);
                uniqueResponse.set('numberOfResponses', 1);
                if (responseObject.get('chosenAnswer') === responseObject.get('correctAnswer'))
                    uniqueResponse.set('spacedRepetitionBox', 2);
                else
                    uniqueResponse.set('spacedRepetitionBox', 1);
                var ACL = new Parse.ACL();
                ACL.setReadAccess(user, true);
                uniqueResponse.setACL(ACL);
            } else {
                uniqueResponse.increment('numberOfResponses');
                // If correct, increment box
                // Else, reset box to 1
                if (responseObject.get('chosenAnswer') === responseObject.get('correctAnswer'))
                    uniqueResponse.increment('spacedRepetitionBox');
                else
                    uniqueResponse.set('spacedRepetitionBox', 1);

                // Highest box should be 4.
                if (uniqueResponse.get('spacedRepetitionBox') > 4)
                    uniqueResponse.set('spacedRepetitionBox', 4);
            }
            uniqueResponse.set('latestResponse', responseObject);
            promises.push(uniqueResponse.save());
            return;
        }, function (error) {
            console.error("Error finding URs for question " + JSON.stringify(error));
        })
        .then(function () {
            return Parse.Promise.when(promises);
        },
        function (error) {
            console.error("Error saving uniqueResponse object from Response.beforeSave. " + JSON.stringify(error));
        });
});
/**
 * -----------------
 * beforeSave Message
 * -----------------
 * - ACLs
 */
Parse.Cloud.beforeSave("Message", function (request, response) {
    /*
     * Consider a cloud function to mark messages
     * as read/unread. Giving write access to
     * sender/recepient may be a minor vulnerability.
     */

    var from = request.object.get('from'),
        to = request.object.get('to'),
        ACLs = Security.createACLs(from, false);

    ACLs.setReadAccess(to, true);
    ACLs.setWriteAccess(to, true);
    request.object.setACL(ACLs);
    response.success();
});
/**
 * -----------------
 * beforeSave Group
 * -----------------
 * - Must verify slug // TODO
 */
Parse.Cloud.beforeSave("Group", function (request, response) {
    var group = request.object,
        user = request.user;

    if (group.get('areRolesSetUp')) {
        /*
         * Old group, in case privacy is changed..
         * Set ACLs accordingly.
         */
        switch (group.get('privacy')) {
            case "open":
                group.getACL().setPublicReadAccess(true);
                break;
            case "closed":
                group.getACL().setPublicReadAccess(true);
                break;
            case "secret":
                group.getACL().setPublicReadAccess(false);
                break;
        }
    }
    return response.success();

});
/**
 * -----------------
 * afterSave Group
 * -----------------
 * - Add group to user's group relation
 * - Roles and ACLs
 */
Parse.Cloud.afterSave("Group", function (request) {
    var group = request.object,
        user = request.user,
        promises = [],
        groupAdminsRole,
        groupModeratorsRole,
        groupMembersRole;

    if (group.get('areRolesSetUp') || !user)
        return;

    Parse.Cloud.useMasterKey();

    var userGroups = user.relation('groups');
    userGroups.add(group);
    promises.push(user.save());

    groupAdminsRole = new Parse.Role("group-admins-" + group.id, new Parse.ACL());
    groupModeratorsRole = new Parse.Role("group-moderators-" + group.id, new Parse.ACL());
    groupMembersRole = new Parse.Role('group-members-' + group.id, new Parse.ACL());
    promises.push(groupAdminsRole.save());
    promises.push(groupModeratorsRole.save());
    promises.push(groupMembersRole.save());
    Parse.Promise.when(promises)
        .then(function () {
            groupMembersRole.getACL().setRoleWriteAccess(groupModeratorsRole, true);
            groupMembersRole.getACL().setRoleReadAccess(groupModeratorsRole, true);
            groupMembersRole.getRoles().add(groupModeratorsRole);

            groupModeratorsRole.getACL().setRoleWriteAccess(groupAdminsRole, true);
            groupModeratorsRole.getACL().setRoleReadAccess(groupAdminsRole, true);
            groupModeratorsRole.getRoles().add(groupAdminsRole);

            groupAdminsRole.getACL().setRoleWriteAccess(groupAdminsRole, true);
            groupAdminsRole.getACL().setRoleReadAccess(groupAdminsRole, true);
            groupAdminsRole.getUsers().add(user);

            promises.push(groupMembersRole.save());
            promises.push(groupModeratorsRole.save());
            promises.push(groupAdminsRole.save());
            return Parse.Promise.when(promises);
        }).then(function () {
            var groupACL = new Parse.ACL(user);
            groupACL.setRoleWriteAccess(groupModeratorsRole, true);
            groupACL.setRoleReadAccess(groupMembersRole, true);
            if (group.get('privacy') === "secret")
                groupACL.setPublicReadAccess(false);
            else
                groupACL.setPublicReadAccess(true);
            group.setACL(groupACL);
            group.set('areRolesSetUp', true);
            return group.save();
        });
});
/**
 * -----------------
 * beforeSave EducationalInstitution
 * -----------------
 * - capitalize name
 * - Use facebookId to set pictureUrl
 * and fbObject if user is fb authenticated
 */
Parse.Cloud.beforeSave("EducationalInstitution", function (request, response) {
    var educationalInstitution = request.object,
        user = request.user;
    // Must have name
    if (!educationalInstitution.get('name') || !educationalInstitution.get('name').length)
        return response.error("Name is required!");

    // Always make sure name is capitalised.
    educationalInstitution.set('name', capitaliseFirstLetter(educationalInstitution.get('name')));
    var query = new Parse.Query("EducationalInstitution");
    query.equalTo('name', educationalInstitution.get('name'));
    if (educationalInstitution.id)
        query.notEqualTo('objectId', educationalInstitution.id);
    query.find()
        .then(function (results) {
            if (results[0]) {
                return Parse.Promise.error({
                    message: "Duplicate Educational Institution detected. Use returned object.",
                    educationalInstitution: results[0]
                });
            }
            if (educationalInstitution.get('facebookId') && (!educationalInstitution.get('pictureUrl')
                || !educationalInstitution.get('pictureUrl').length)) {
                educationalInstitution.set('pictureUrl',
                    "https://res.cloudinary.com/mycqs/image/facebook/c_thumb,e_improve,w_150/" +
                    educationalInstitution.get('facebookId'));
                if (!educationalInstitution.get('fbObject') && user && user.get('authData') && user.get('authData').facebook) {
                    return Parse.Cloud.httpRequest({
                        url: 'https://graph.facebook.com/v2.2/' + educationalInstitution.get('facebookId')
                        + "?access_token=" + user.get('authData').facebook.access_token,
                    }).then(function (httpResponse) {
                        educationalInstitution.set('fbObject', httpResponse.data);
                        educationalInstitution.set('cover', httpResponse.data.cover);
                        return;
                    });
                }
            }
        }).then(function () {
            return response.success();
        }, function (error) {
            return response.success(error);
        });
});
/**
 * -----------------
 * beforeSave StudyField
 * -----------------
 * - capitalize name
 * - Use facebookId to set pictureUrl
 * and fbObject if user is fb authenticated
 */
Parse.Cloud.beforeSave("StudyField", function (request, response) {
    var studyField = request.object,
        user = request.user;

    if (!studyField.get('name') || !studyField.get('name').length)
        return response.error("Name is required!");

    studyField.set('name', capitaliseFirstLetter(studyField.get('name')));
    var query = new Parse.Query("StudyField");
    query.equalTo('name', studyField.get('name'));
    if (studyField.id)
        query.notEqualTo('objectId', studyField.id);
    query.find()
        .then(function (results) {
            if (results[0]) {
                return Parse.Promise.error({
                    message: "Duplicate Study field detected. Use returned object.",
                    studyField: results[0]
                });
            }
            if (studyField.get('facebookId') && (!studyField.get('pictureUrl') || !studyField.get('pictureUrl').length)) {
                studyField.set('pictureUrl',
                    "https://res.cloudinary.com/mycqs/image/facebook/c_thumb,e_improve,w_150/" +
                    studyField.get('facebookId'));
                if (!studyField.get('fbObject') && user && user.get('authData') && user.get('authData').facebook) {
                    return Parse.Cloud.httpRequest({
                        url: 'https://graph.facebook.com/v2.2/' + studyField.get('facebookId')
                        + "?access_token=" + user.get('authData').facebook.access_token,
                    }).then(function (httpResponse) {
                        studyField.set('fbObject', httpResponse.data);
                        return;
                    });
                }
            }
        }).then(function () {
            return response.success();
        }, function (error) {
            return response.success(error);
        });
});
/**
 * -----------------
 * beforeSave Course
 * -----------------
 * capialize course.name
 */
Parse.Cloud.beforeSave("Course", function (request, response) {
    var course = request.object;

    if (course.get('name'))
        course.set('name', capitaliseFirstLetter(course.get('name')));

    response.success();
});
/**
 * ----------------------
 * beforeSave Institution
 * ---------------------
 * capialize institution.fullName
 */
Parse.Cloud.beforeSave("Institution", function (request, response) {
    var institution = request.object;

    if (institution.get('fullName'))
        institution.set('fullName', capitaliseFirstLetter(institution.get('fullName')));

    response.success();
});