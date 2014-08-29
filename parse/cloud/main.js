var _ = require("underscore");

/*
 * Temporarily a job: ideally will be a beforeSave hook
 */
Parse.Cloud.job("findAndStoreFriends", function (request, status) {
    var query = new Parse.Query(Parse.User);
    query.doesNotExist('friends');
    query.each(function (user) {

    }).then(function () {
        status.success('Friends set');
    });

});

/*
 * CALCULATIONS
 */
Parse.Cloud.job("calculateTotalTestsInCategory", function (request, status) {
    /*
     * Reset totalTests counter in each category
     */
    var query = new Parse.Query('Category');
    query.each(function (category) {
        category.set('totalTests', 0);
        return category.save();
    }).then(function () {
        /*
         * Loop through each test, incrementing it's category.totalTests
         * and category.parent.totalTests if available.
         */
        var testsInCategoryQuery = new Parse.Query('Test');
        testsInCategoryQuery.include('category.parent');
        return testsInCategoryQuery.each(function (test) {
            if (test.get('category')) {
                test.get('category').increment('totalTests');
                if (test.get('category').get('parent')) {
                    test.get('category').get('parent').increment('totalTests');
                    test.get('category').get('parent').save();
                }
                return test.get('category').save();
            }
            return test;
        });
    }).then(function () {
        status.success("Total tests in each category calculated successfully.");
    });
});

/*
 * GENERATE CONTENT
 */
function generateTests(moduleId, difficulty, totalQuestions, user, callback) {
    console.log("Started generating");

    var promise = new Parse.Promise();
    var query = new Parse.Query("Module");

    console.log("Finding module with id: " + moduleId);

    query.get(moduleId, {
        success: function (module) {
            console.log("Found module");
            console.log("MODULE: " + JSON.stringify(module));

            var easyQuota = 0;
            var moderateQuota = 0;
            var difficultQuota = 0;

            if (difficulty === 1) {
                easyQuota = 6;
                moderateQuota = 4;
                difficultQuota = 0;
            }
            else if (difficulty === 2) {
                easyQuota = 2;
                moderateQuota = 6;
                difficultQuota = 2;
            }
            if (difficulty === 3) {
                easyQuota = 0;
                moderateQuota = 4;
                difficultQuota = 6;
            }

            var numEasy = 0;
            var numModerate = 0;
            var numDifficult = 0;
            var queryArray = new Array();

            var tags = module.get("tags");
            console.log("TAGS: " + tags);

            for (var i = 0; i < tags.length; i++) {
                var aQuery = new Parse.Query("Question");
                var singleArray = new Array();
                singleArray.push(tags[i]);
                aQuery.containsAll("tags", singleArray);
                console.log("Added tag: " + tags[i]);
                queryArray.push(aQuery);
            }

            var orQuery = new Parse.Query.or(queryArray[0], queryArray[1], queryArray[2]);
            orQuery.greaterThanOrEqualTo("quality", 5);
            orQuery.equalTo("level", module.get("level"));
            orQuery.equalTo("category", module.get("category"));

            console.log("QUERY: " + JSON.stringify(orQuery));

            orQuery.find({
                success: function (results2) {

                    console.log("Found questions: " + JSON.stringify(results2));

                    var Test = Parse.Object.extend("Test");

                    var Question = Parse.Object.extend("Question");

                    var test = new Test();
                    test.set("title", "New Generated " + module.get("shortName") + " test");
                    test.set("author", user);
                    test.set("isGenerated", true);
                    test.set("questionsPerAttempt", 0);
                    test.set("module", module);

                    console.log("RESULTS LENGTH: " + results2.length);

                    var addQuestion = false;

                    for (var i = 0; i < results2.length; i++) {
                        addQuestion = false;

                        var question = results2[i];
                        console.log("Looping results " + i);
                        console.log("Question difficulty = " + question.get("difficulty"));

                        if (question.get("difficulty") === 1) {
                            if (numEasy <= easyQuota) {
                                addQuestion = true;
                                console.log("Adding easy question");
                                console.log("Add question? " + addQuestion);
                                numEasy++;
                            }
                        }
                        else if (question.get("difficulty") === 2) {
                            if (numModerate <= moderateQuota) {
                                addQuestion = true;
                                console.log("Adding moderate question");
                                console.log("Add question? " + addQuestion);
                                numModerate++;
                            }
                        }
                        else if (question.get("difficulty") === 3) {
                            if (numDifficult <= difficultQuota) {
                                addQuestion = true;
                                console.log("Adding hard question");
                                console.log("Add question? " + addQuestion);
                                numDifficult++;
                            }
                        }

                        console.log("FINAL ADD QUESTION: " + addQuestion);

                        if (addQuestion) {
                            test.add("questions", question);
                            console.log("Adding new question to test: " + question.get("stem"));
                        }
                        else {
                            console.log("Not adding question");
                        }

                    }

                    test.save(null, {
                        success: function (newTest) {
//                                  
                            callback(newTest);


                        },
                        error: function (newTest, error) {
                        }
                    });
                },
                error: function (error) {
                    //                    response.error("ERROR 1" + JSON.stringify(error));
                }
            });
        },
        error: function (error) {
            console.log("Error finding module: " + error);
        }
    });
};

Parse.Cloud.define("unfollowUser", function (request, response) {
    Parse.Cloud.useMasterKey()

    var query = new Parse.Query(Parse.User);

    query.get(request.params.mainUser, {
        success: function (mainUser) {
            query.get(request.params.userToUnfollow, {
                success: function (userToUnfollow) {

                    var relation = mainUser.relation("following");
                    relation.remove(userToUnfollow);
                    mainUser.increment("numberFollowing", -1);
                    mainUser.save().then(function (obj) {

                        var relation2 = userToUnfollow.relation("followers");
                        relation2.remove(mainUser);
                        userToUnfollow.increment("numberOfFollowers", -1);
                        userToUnfollow.save().then(function (obj) {
                            response.success();
                        }, function (error) {
                            response.error(error.description);
                        });

                    }, function (error) {
                        response.error();
                    });

                }, error: function (error) {
                    response.error(error.description);
                }});
        }, error: function (error) {
            response.error(error.description);
        }
    });
});

Parse.Cloud.define("followUser", function (request, response) {
    Parse.Cloud.useMasterKey()

    var query = new Parse.Query(Parse.User);

    query.get(request.params.mainUser, {
        success: function (mainUser) {
            query.get(request.params.userToFollow, {
                success: function (userToFollow) {

                    var relation = mainUser.relation("following");
                    relation.add(userToFollow);
                    mainUser.increment("numberFollowing");
                    mainUser.save().then(function (obj) {

                        var relation2 = userToFollow.relation("followers");
                        relation2.add(mainUser);
                        userToFollow.increment("numberOfFollowers");
                        userToFollow.save().then(function (obj) {


                            console.log("Sending push");
                            var query = new Parse.Query(Parse.Installation);
                            query.equalTo('user', mainUser.id);
                            console.log("...push");
                            Parse.Push.send({
                                where: query, // Set our Installation query
                                data: {
                                    alert: "" + userToFollow.get("name") + " started following you!",
                                    badge: "Increment",
                                    sound: "defaut.caf",
                                    title: "MyCQs"
                                }
                            }, {
                                success: function () {
                                    console.log("Success sending push message");
                                    response.success();
                                },
                                error: function (error) {
                                    // Handle error
                                    console.log("ERROR SENDING PUSH: " + JSON.stringify(error));
                                    response.success();
                                }
                            });


                        }, function (error) {
                            response.error(error.description);
                        });

                    }, function (error) {
                        response.error();
                    });

                }, error: function (error) {
                    response.error(error.description);
                }});
        }, error: function (error) {
            response.error(error.description);
        }
    });
});

Parse.Cloud.define("findTestsForModule", function (request, response) {

//    var module = new Parse.Object("Module");
//    module.id = request.params.moduleId;

    var getQuery = new Parse.Query("Module");

    getQuery.get(request.params.moduleId).then(function (module) {

        var moduleQuery = new Parse.Query("Test");
        moduleQuery.equalTo("module", module);

        console.log("Looking for tests with module id: " + request.params.moduleId);

        var subQuery = new Parse.Query("Module");
        subQuery.equalTo("category", module.category);

        var categoryQuery = new Parse.Query("Test");
        categoryQuery.matchesQuery("module", subQuery);


        var query = new Parse.Query.or(moduleQuery, categoryQuery);
        query.include("author");
        query.include("module");
        query.include("author.institution");
        query.include("author.course");

        query.find({
            success: function (results) {

                console.log("Found existing tests: " + results.length);

                var generatedTestAlreadyExists = false;
                var moduleObject;

                for (var i = 0; i < results.length; i++) {
                    if (results[i].get("isGenerated")) {
                        generatedTestAlreadyExists = true;
                        break;
                    }
                }
                if (generatedTestAlreadyExists) {
                    //no need to make a new test
                    response.success(results);
                }
                else {
                    generateTests(request.params.moduleId, 1, 10, request.user, function (response2) {
                        console.log("CALLBACK INVOKED: " + response2);
                        console.log("Generate, results length: " + results.length);
                        results.push(response2);
                        console.log("Added one two results, now: " + results.length);
                        console.log("RESULTS: " + JSON.stringify(results));
                        response.success(results);
                    });
                }
            },

            error: function (error) {
                response.error(error);
            }
        });
    });
});


Parse.Cloud.define("generateTestForModule", function (request, response) {
    console.log("GENERATE TEST PARAMS: " + JSON.stringify(request));
    var difficulty = request.params.difficulty;
    var totalQuestions = request.params.totalQuestions;

    var query = new Parse.Query("Module");

    query.get(request.params.moduleId, {
        success: function (module) {

            console.log("MODULE: " + JSON.stringify(module));

            var easyQuota = 0;
            var moderateQuota = 0;
            var difficultQuota = 0;
            if (difficulty === 1) {
                easyQuota = 6;
                moderateQuota = 4;
                difficultQuota = 0;
            }
            else if (difficulty === 2) {
                easyQuota = 2;
                moderateQuota = 6;
                difficultQuota = 2;
            }
            if (difficulty === 3) {
                easyQuota = 0;
                moderateQuota = 4;
                difficultQuota = 6;
            }

            var numEasy = 0;
            var numModerate = 0;
            var numDifficult = 0;
            var queryArray = new Array();

            var tags = module.get("tags");
            console.log("TAGS: " + tags);

            for (var i = 0; i < tags.length; i++) {
                var aQuery = new Parse.Query("Question");
                var singleArray = new Array();
                singleArray.push(tags[i]);
                aQuery.containsAll("tags", singleArray);
                console.log("Added tag: " + tags[i]);
                queryArray.push(aQuery);
            }

            var orQuery = new Parse.Query.or(queryArray[0], queryArray[1], queryArray[2]);
            orQuery.greaterThanOrEqualTo("quality", 5);
            orQuery.equalTo("level", module.get("level"));
            orQuery.equalTo("category", module.get("category"));

            console.log("QUERY: " + JSON.stringify(orQuery));

            orQuery.find({
                success: function (results2) {

                    console.log("Found questions: " + JSON.stringify(results2));

                    var Test = Parse.Object.extend("Test");

                    var Question = Parse.Object.extend("Question");

                    var test = new Test();
                    test.set("title", "New Generated " + module.get("shortName") + " test");
                    test.set("author", request.user);
                    test.set("isGenerated", true);
                    test.set("questionsPerAttempt", 0);
                    test.set("module", module);

                    console.log("RESULTS LENGTH: " + results2.length);

                    var addQuestion = false;

                    for (var i = 0; i < results2.length; i++) {
                        addQuestion = false;

                        var question = results2[i];
                        console.log("Looping results " + i);
                        console.log("Question difficulty = " + question.get("difficulty"));

                        if (question.get("difficulty") === 1) {
                            if (numEasy <= easyQuota) {
                                addQuestion = true;
                                console.log("Adding easy question");
                                console.log("Add question? " + addQuestion);
                                numEasy++;
                            }
                        }
                        else if (question.get("difficulty") === 2) {
                            if (numModerate <= moderateQuota) {
                                addQuestion = true;
                                console.log("Adding moderate question");
                                console.log("Add question? " + addQuestion);
                                numModerate++;
                            }
                        }
                        else if (question.get("difficulty") === 3) {
                            if (numDifficult <= difficultQuota) {
                                addQuestion = true;
                                console.log("Adding hard question");
                                console.log("Add question? " + addQuestion);
                                numDifficult++;
                            }
                        }

                        console.log("FINAL ADD QUESTION: " + addQuestion);

                        if (addQuestion) {
                            test.add("questions", question);
                            console.log("Adding new question to test: " + question.get("stem"));
                        }
                        else {
                            console.log("Not adding question");
                        }

                    }

                    test.save(null, {
                        success: function (newTest) {
                            response.success(newTest);
                        },
                        error: function (newTest, error) {
                            response.error("There was an error: " + JSON.stringify(error));
                        }
                    });
                },
                error: function (error) {
                    response.error("ERROR 1" + JSON.stringify(error));
                }
            });
        },
        error: function (error) {

        }
    });
});

Parse.Cloud.define("findTestsForUser", function (request, response) {

    var query = new Parse.Query(Parse.User);
    query.include("course");

    query.get(request.params.userId, {
        success: function (results) {
            console.log("USER INFO: " + JSON.stringify(results));
            var user = results;
            var course = results.get("course");
            var structure = course.get("structure");
            console.log("Structure: " + JSON.stringify(structure));
            var years = structure.years;
            var currentYear = structure.years[results.get("year")];

            console.log("Current year: " + JSON.stringify(currentYear));

            var module = currentYear.modules[1];
            var difficulty = 1;
            var totalQuestions = 10;

            var easyQuota = 0;
            var moderateQuota = 0;
            var difficultQuota = 0;


            if (difficulty === 1) {
                easyQuota = 6;
                moderateQuota = 4;
                difficultQuota = 0;
            }
            else if (difficulty === 2) {
                easyQuota = 2;
                moderateQuota = 6;
                difficultQuota = 2;
            }
            if (difficulty === 3) {
                easyQuota = 0;
                moderateQuota = 4;
                difficultQuota = 6;
            }

            var numEasy = 0;
            var numModerate = 0;
            var numDifficult = 0;

            var queryArray = new Array();

            for (var i = 0; i < module.tags.length; i++) {
                var aQuery = new Parse.Query("Question");
                var singleArray = new Array();
                singleArray.push(module.tags[i]);
                aQuery.containsAll("tags", singleArray);
                queryArray.push(aQuery);
            }

            var orQuery = new Parse.Query.or(queryArray[0], queryArray[1], queryArray[2]);
            orQuery.greaterThanOrEqualTo("quality", 5);
            orQuery.equalTo("level", module.level);
            orQuery.equalTo("category", module.category);

            orQuery.find({
                success: function (results2) {

                    var Test = Parse.Object.extend("Test");

                    var Question = Parse.Object.extend("Question");

                    var test = new Test();
                    test.set("title", "Generated " + module.acronym + " test");
                    test.set("author", user);
                    test.set("isGenerated", true);
                    test.set("questionsPerAttempt", 0);

                    for (var i = 0; i < results2.length; i++) {
                        var addQuestion = false;
                        var question = results2[i];
                        if (question.get("difficulty") === 1) {
                            if (numEasy <= easyQuota) {
                                adduestion = true;
                                numEasy++;
                            }
                        }
                        else if (question.get("difficulty") === 2) {
                            if (numModerate <= moderateQuota) {
                                adduestion = true;
                                numModerate++;
                            }
                        }
                        else if (question.get("difficulty") === 3) {
                            if (numDifficult <= difficultQuota) {
                                adduestion = true;
                                numDifficult++;
                            }
                        }
                        if (addQuestion) {
                            test.add("questions", question);
                        }

                    }

                    test.save(null, {
                        success: function (newTest) {
                            response.success("Returning test: " + newTest);
                        },
                        error: function (newTest, error) {
                            response.error("There was an error: " + JSON.stringify(error));
                        }
                    });


                },
                error: function (error) {
                    response.error("ERROR 1" + JSON.stringify(error));
                }
            });

        },
        error: function (error) {
            response.error("ERROR 2" + error);
        }
    });

});
/*
 * Useful functions
 */
/*
 * Index Tests' info for searching
 * Also done beforeSave on new Tests, hence
 * separating the code into its own function
 */
/**
 * ------------------
 * generateSearchTags
 * ------------------
 * Used for indexing tests by splitting title into
 * a string array without 'stop words' such as
 * 'the, of, and'. Array is saved in 'tags' and
 * should be queried like so:
 * where: { "tags": { "$all" : ["user's", "search", "terms"] } }
 *
 * @param test
 * @returns []
 */
var generateSearchTags = function (test) {
    var toLowerCase = function (w) {
        return w.toLowerCase();
    };

    var words = (test.get("title") + test.get('description')).split(/\b/);
    words = _.map(words, toLowerCase);
    var stopWords = ["the", "in", "and", "test", "mcqs", "of", "a", "an"]
    words = _.filter(words, function (w) {
        return w.match(/^\w+$/) && !_.contains(stopWords, w);
    });
    words = _.uniq(words);
    return words;
};
/**
 * --------
 * slugify
 * -------
 *
 * @param className
 * @param string
 * @returns {*}
 */
var slugify = function (className, string) {
    if (className !== "_User")
        return string.toLowerCase().replace(/ /g, '-').replace(/[-]+/g, '-').replace(/[^\w-]+/g, '');
    else {
        var firstInitial = string.charAt(0),
            lastName = string.split(" ")[string.split(" ").length - 1],
            slug = (firstInitial + lastName).toLowerCase();
        return slug;
    }
}


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
 * Easiest solution, never permenantly delete tests, simply add isDeleted row with no-read ACL?
 */
/**
 * ----------------
 * beforeSave _User
 * ----------------
 * SET slug IF object.isNew() || !slug && !anonymous
 * UPDATE numberFollowing and numberOfFollowers IF:
 * - NOT setting slug &&
 * - existed()
 */
Parse.Cloud.beforeSave('_User', function (request, response) {
    Parse.Cloud.useMasterKey();
    if ((request.object.isNew() || !request.object.get('slug') || !request.object.get('slug').length) &&
        request.object.get('name') && request.object.get('name').length) {
        /*
         * Create a unique slug
         */
        var slug = slugify('_User', request.object.get('name'));
        /*
         * Check if slug is unique before saving
         */
        var query = new Parse.Query(Parse.User);
        query.startsWith('slug', slug);
        query.count().then(function (count) {
            if (!count)
                request.object.set('slug', slug);
            else
                request.object.set('slug', slug + (count + 1));
            /*
             * Joined MyCQs Action
             */
            var Action = Parse.Object.extend('Action');
            var action = new Action();
            action.set('user', request.object.get('user'));
            action.set('type', 'joinedMyCQs');
            action.save();
            response.success();
        });
    } else if (request.object.existed()) {
        response.success();
        /*
         * Followers and following count update
         */
        /*
         var followingRelation = request.object.relation("following");
         followingRelation.query().count()
         .then(function (count) {
         request.object.set("numberFollowing", count);
         var followersRelation = request.object.relation("followers");
         return followersRelation.query().count();
         }).then(function (count) {
         request.object.set("numberOfFollowers", count);
         response.success();
         });
         */
    } else
        response.success();
});
/**
 * ----------------
 * afterSave _User
 * ----------------
 * No use for this yet
 * Followers and following moved to beforeSave
 */
/*Parse.Cloud.afterSave("_User", function (request, response) {
 Parse.Cloud.useMasterKey();

 });*/
Parse.Cloud.beforeSave('Category', function (request, response) {
    if (request.object.isNew() || !request.object.get('slug') || !request.object.get('slug').length) {
        /*
         * Create a unique slug
         */
        var slug = slugify('Category', request.object.get('name'));
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
    request.object.set("tags", generateSearchTags(request.object));


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

        var query = new Parse.Query(Parse.User);
        query.get(request.object.get("author").id, function (user) {
                if (request.object.isNew()) {
                    user.set("numberOfPoints", user.get("numberOfPoints") + 10);
                    user.save();
                }
                /*
                 * Create a unique slug
                 */
                var slug = user.get('slug') + '-' + slugify('Test', request.object.get('title'));
                /*
                 * Check if slug is unique before saving
                 */
                var Test = Parse.Object.extend('Test'),
                    query = new Parse.Query(Test);
                query.startsWith('slug', slug);
                query.count().then(function (count) {
                    if (!count)
                        request.object.set('slug', slug);
                    else
                        request.object.set('slug', slug + '-' + (count + 1));

                    response.success();
                });


            },
            function (error) {

            });
    }
    else {
        response.success();
    }
});
/**
 * ----------------
 * afterSave Test
 * ----------------
 * SET test to author.savedTests relations IF test.isNew()
 * * Questionable whether this is necessary *
 */
Parse.Cloud.afterSave("Test", function (request, response) {
    Parse.Cloud.useMasterKey();
    var authorObjectId = request.object.get('author').id,
        author;

    var query = new Parse.Query(Parse.User);
    query.get(authorObjectId).then(function (result) {
        author = result;
        if (request.object.isNew()) {
            author.increment("numberOfTests");
            var relation = author.relation('savedTests');
            relation.add(request.object);
        }
        var Test = Parse.Object.extend('Test');
            query = new Parse.Query(Test);
        query.equalTo('author', author);
        query.include('questions');
        return query.find();
    }).then(function(tests) {
        var numberOfQuestions = 0;
        for(var i = 0; i < tests.length; i++) {
            var test = tests[i];
            if(test.get('questions'))
                numberOfQuestions += test.get('questions').length;
        }
        author.set('numberOfQuestions', numberOfQuestions);
        author.save();
        /*
         * AttemptFinished Action
         */
        var Action = Parse.Object.extend('Action');
        var action = new Action();
        action.set('user', author);
        action.set('test', request.object);
        action.set('type', 'testCreated');
        action.save();
    });
});

Parse.Cloud.beforeSave("Question", function (request, response) {
    if (request.object.isNew()) {
        request.object.set("numberOfTimesTaken", 0);
        request.object.set("numberAnsweredCorrectly", 0);
        request.object.set("quality", 5);
        request.object.set("difficulty", 5);

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
 * - Update test score stats
 * - Create an Action object for User 'attemptFinished'
 * - Replace this attempt in the User's latestAttempts pointers for this test
 */
Parse.Cloud.beforeSave("Attempt", function (request, response) {

    if (request.object.isNew()) {
        var Attempt = Parse.Object.extend("Attempt");
        var query = new Parse.Query(Attempt);


        query.equalTo("test", request.object.get("test"));
        query.equalTo("user", request.object.get("user"));

        query.count({
            success: function (number) {
                request.object.set("number", number + 1);


                var query = new Parse.Query(Parse.User);
                query.get(request.object.get("user").id, function (user) {

                        user.increment("numberOfAttempts");
                        user.increment("points");
                        user.save();
                        response.success();


                    },
                    function (error) {

                    });


            },
            error: function (object, error) {

            }
        });

    }
    else {
        response.success();
    }

});
/**
 * -----------------
 * afterSave Attempt
 * -----------------
 * - Update Test objects score stats
 * - Create an Action object for User 'attemptFinished'
 * - Replace this attempt in the User's latestAttempts pointers for this test
 */
Parse.Cloud.afterSave("Attempt", function (request, response) {
    if (request.object.existed()) {
        response.success();
        return;
    }
    /*
     * Test statistics
     */
    var Test = Parse.Object.extend("Test"),
        query = new Parse.Query(Test);
    query.include('author');

    query.get(request.object.get("test").id, {
        success: function (test) {
            //increase average score & number of attempts
            test.increment("numberOfAttempts");
            test.set("cumulativeScore", (test.get("cumulativeScore") + request.object.get("score")));
            test.set("averageScore", (test.get("cumulativeScore") + request.object.get("score")) / (test.get("numberOfAttempts") + 1));

            if (request.object.get("number") == 1) {
                test.increment("numberOfUniqueAttempts");
                test.set("uniqueCumulativeScore", (test.get("uniqueCumulativeScore") + request.object.get("score")));
                test.set("uniqueAverageScore", (test.get("uniqueCumulativeScore") + request.object.get("score")) / (test.get("uniqueNumberOfAttempts") + 1));

                if (test.get("uniqueAverageScore") >= 80) {
                    test.set("difficulty", 1);
                }
                else if (test.get("uniqueAverageScore") < 80 && test.get("uniqueAverageScore") >= 50) {
                    test.set("difficulty", 2);
                }
                else if (test.get("uniqueAverageScore") < 50) {
                    test.set("difficulty", 3);
                }
            }
            /*
             * If test taker is not the author:
             * Increment test author's communityNumberOfAttempts and
             * update communityAverageScore;
             */
            if(test.get('author').id !== request.object.get('user').id) {
                test.get('author').increment('communityNumberOfAttempts');
                var communityAverageScore = test.get('author').get('communityAverageScore');
                if(!communityAverageScore)
                    communityAverageScore = 0;
                communityTotalScoreProjection = communityAverageScore * test.get('author').get('communityNumberOfAttempts');
                communityTotalScoreProjection += request.object.get('score');
                test.get('author').set('communityAverageScore',
                    Math.round(communityTotalScoreProjection / test.get('author').get('communityNumberOfAttempts')));
                test.get('author').save();
            }
            test.save();
        },
        error: function (object, error) {
            console.log("Error retrieving test");
            // The object was not retrieved successfully.
            // error is a Parse.Error with an error code and description.
        }
    });
    /*
     * AttemptFinished Action
     */
    var Action = Parse.Object.extend('Action');
    var action = new Action();
    action.set('attempt', request.object);
    action.set('user', request.object.get('user'));
    action.set('test', request.object.get('test'));
    action.set('value', request.object.get('score'));
    action.set('type', 'attemptFinished');
    action.save();

    /*
     * Add attempt object to latestAttempts on user
     * Increment numberOfAttempts on user
     * Update average score on user
     */
    var user = request.object.get('user');
    var query = new Parse.Query(Parse.User);
    query.include('latestAttempts.test');
    query.get(user.id).then(function (user) {

        if (!user.get('latestAttempts')) {
            user.set('latestAttempts', []);
            user.get('latestAttempts').push(request.object);
        } else {
            var previousAttemptFound = false;
            for (var i = 0; i < user.get('latestAttempts').length; i++) {
                var test = user.get('latestAttempts')[i].get('test');
                if (!test)
                    continue;
                if (test.id === request.object.get('test').id) {
                    user.get('latestAttempts')[i] = request.object;
                    previousAttemptFound = true;
                    break;
                }
            }
            if (!previousAttemptFound)
                user.get('latestAttempts').push(request.object);
        }
        /*
         * Increment numberOfAttempts and
         * update averageScore for user
         */
        user.increment('numberOfAttempts');
        var averageScore = user.get('averageScore');
        if(!averageScore)
            averageScore = 0;
        var totalScoreProjection = averageScore * user.get('numberOfAttempts');
        totalScoreProjection += request.object.get('score');
        user.set('averageScore', Math.round(totalScoreProjection / user.get('numberOfAttempts')));
        if(!previousAttemptFound) {
            /*
             * This is a unique attempt
             * Increment numberOfUniqueAttempts and
             * update uniqueAverageScore score for user
             */
            user.increment('numberOfUniqueAttempts');
            var uniqueAverageScore = user.get('uniqueAverageScore');
            if(!uniqueAverageScore)
                uniqueAverageScore = 0;
            var totalUniqueScoreProjection = uniqueAverageScore * user.get('numberOfUniqueAttempts');
            totalUniqueScoreProjection += request.object.get('score');
            user.set('uniqueAverageScore', Math.round(totalUniqueScoreProjection / user.get('numberOfUniqueAttempts')));
        }
        user.save();
    });
});

/*
 Parse.Cloud.afterSave("Response", function (request) {

 //TOOD edit so only first attempt counts towards community averages

 var Question = Parse.Object.extend("Question");
 var query = new Parse.Query(Question);

 query.get(request.object.get("question").id, {
 success: function (question) {
 console.log("Query successful, found question: " + JSON.stringify(question));

 question.increment("numberOfTimesTaken");

 if (request.object.get("chosenAnswer") === request.object.get("correctAnswer")) {
 question.increment("numberAnsweredCorrectly");
 }

 var options = question.get("options");

 for (var i = 0; i < options.length; i++) {
 console.log("Looping through options");
 if (options[i].phrase === request.object.get("chosenAnswer")) {
 console.log("Found chosen option");
 options[i].numberOfTimesChosen = options[i].numberOfTimesChosen + 1;
 }
 }

 question.set("options", options);
 console.log("Query successful, updated question: " + JSON.stringify(question));
 question.save();
 },
 error: function (object, error) {
 console.log("Error retrieving test");
 // The object was not retrieved successfully.
 // error is a Parse.Error with an error code and description.
 }
 });
 });*/