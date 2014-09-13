require('cloud/app.js');
var _ = require("underscore");
var mandrillKey = 'zAg8HDZtlJSoDu-ozHA3HQ';

Mandrill = require('mandrill')
Mandrill.initialize(mandrillKey);

/*
 * SIGN UP LOGIC
 */
Parse.Cloud.define("preFacebookConnect", function (request, response) {
    Parse.Cloud.useMasterKey();
    var authResponse = request.params.authResponse,
        query = new Parse.Query(Parse.User);
    query.equalTo('fbid', authResponse.userID);
    query.find().then(function (results) {
            if (results[0]) {
                var user = results[0];
                if (user.get('authData')) {
                    response.success();
                    return;
                } else {
                    var authData = {
                        facebook: {
                            access_token: authResponse.accessToken,
                            id: authResponse.userID,
                            expiration_date: (new Date(2032, 2, 2)).toISOString()
                        }
                    };
                    user.set('authData', authData);
                    user.save();
                }
            }
            response.success();
        },
        function (error) {

            response.error(error);
        }
    );
});
/*
 * Username suggestion from Email
 * Not being used currently.

 Parse.Cloud.define("generateUniqueUsernameFromEmail", function (request, response) {
 var email = request.params.email,
 query = new Parse.Query("UserPrivate"),
 username = email.substring(0, email.indexOf("@"));

 query.equalTo('email', email);

 query.count().then(function (count) {
 if (count) {
 response.error({message: "Email already taken!"});
 return;
 } else {
 query = new Parse.Query(Parse.User);
 query.startsWith('username', username);
 return query.count();
 }
 }).then(function (count) {
 if (count) {
 response.success({username: username + count});
 } else {
 response.success({username: username});
 }
 return;
 });
 });
 */

function sendEmail(templateName, user) {
    /*
     * Send welcome email via Mandrill
     */
    var query = new Parse.Query(Parse.User);
    query.get(user.id, function (user) {

            console.log("USER FOUND: " + JSON.stringify(user));
            var nameArray = user.get("name").split(" ");
            var firstName = nameArray[0];

            Mandrill.sendTemplate({
                template_name: "welcome-email",
                template_content: [],
                message: {
                    subject: "Hey " + firstName + ", welcome to MyCQs!",
                    from_email: "no-reply@mycqs.com",
                    from_name: "MyCQs Welcome",
                    global_merge_vars: [
                        {"name": "FNAME", "content": firstName}
                    ],
                    to: [
                        {
                            email: user.get("email"),
                            name: user.get("fullName")
                        }
                    ]
                },
                async: true
            }, {

                success: function (httpResponse) {
                    console.log("Sent welcome email: " + JSON.stringify(httpResponse));
                },
                error: function (httpResponse) {
                    console.error("Erorr sending welcome email: " + JSON.stringify(httpResponse));
                }
            });
        },
        function (error) {
            console.log("Error fetching user");
        });

}

Parse.Cloud.define("sendPushToUser", function (request, response) {
    var senderUser = request.user;
    var recipientUserId = request.params.recipientId;
    var message = request.params.message;

    // Validate that the sender is allowed to send to the recipient.
    // For example each user has an array of objectIds of friends
    if (senderUser.get("friendIds").indexOf(recipientUserId) === -1) {
        response.error("The recipient is not the sender's friend, cannot send push.");
    }

    // Validate the message text.
    // For example make sure it is under 140 characters
    if (message.length > 140) {
        // Truncate and add a ...
        message = message.substring(0, 137) + "...";
    }

    // Send the push.
    // Find devices associated with the recipient user
    var recipientUser = new Parse.User();
    recipientUser.id = recipientUserId;
    var pushQuery = new Parse.Query(Parse.Installation);
    pushQuery.equalTo("user", recipientUser);

    // Send the push notification to results of the query
    Parse.Push.send({
        where: pushQuery,
        data: {
            alert: message
        }
    }).then(function () {
        response.success("Push was sent successfully.")
    }, function (error) {
        response.error("Push failed to send with error: " + error.message);
    });
});

/*
 * Search indexing
 */
Parse.Cloud.job("indexObjectsForClass", function (request, status) {
    var className = request.params.className;
    var query = new Parse.Query(className);
    query.each(function (object) {
        object.set('tags', generateSearchTags(className, object));
        object.save();
    }).then(function () {
        status.success();
    });

});
/*
 * CALCULATIONS
 */
Parse.Cloud.job("calculateTotalTestsInEachCategory", function (request, status) {
    Parse.Cloud.useMasterKey();
    /*
     * Get all bottom level
     * categories:
     * - No children
     * - Has tests directly associated
     * with it)
     */
    var childCategories = [],
        testCounts = [],
        parentCategories = [],
        saveCategoriesPromises = [];

    var lookup = function (array, object) {
        for (var i = 0; i < array.length; i++) {
            if (array[i].id === object.id)
                return array[i];
        }
        return false;
    };

    var query = new Parse.Query('Category');
    query.equalTo('hasChildren', false);
    query.include('parent');
    query.each(function (category) {
        /*
         * Count the number of tests
         * belonging to this category
         */
        var testQuery = new Parse.Query('Test');
        testQuery.equalTo('category', category);
        childCategories.push(category);
        testCounts.push(testQuery.count());
        if (category.get('parent') && !lookup(parentCategories, category.get('parent'))) {
            category.get('parent').set('totalTests', 0);
            parentCategories.push(category.get('parent'));
        }
    }).then(function () {
        return Parse.Promise.when(testCounts);
    }).then(function () {
        for (var i = 0; i < childCategories.length; i++) {
            var childCategory = childCategories[i],
                totalTests = testCounts[i]._result[0];

            childCategory.set('totalTests', totalTests);
            if (childCategory.get('parent')) {
                var parentCategory = lookup(parentCategories, childCategory.get('parent'));
                parentCategory.increment('totalTests', totalTests);
            }
            saveCategoriesPromises.push(childCategory.save());
        }

        for(var i = 0; i < parentCategories.length; i++) {
            saveCategoriesPromises.push(parentCategories[i].save());
        }
        return Parse.Promise.when(saveCategoriesPromises);
    }).then(function() {
        status.success();
    })
});
/*
 * GENERATE CONTENT
 */
function generateTests(moduleId, difficulty, totalQuestions, user, callback) {

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

/**
 * --------------------
 * updateUserEducation
 * -------------------
 * Central logic for maintaining course and
 * university objects while updating the user's
 * education pointers and info.
 *
 * request.params:
 * @param education {
 *  courseName
 *  courseFacebookId (optional)
 *  courseLength (optional)
 *  institutionName
 *  institutionFacebookId (optional)
 *  yearNumber
 * }
 *
 * @returns course, university
 */
Parse.Cloud.define("updateUserEducation", function (request, response) {
    Parse.Cloud.useMasterKey();
    var education = request.params.education,
        user = request.user;

    /*
     * Find university from institutionName
     * Otherwise create a new university object
     */
    var query = new Parse.Query('University');
    query.equalTo('fullName', education.institutionName);

    query.find()
        .then(function (results) {
            if (results.length) {
                /*
                 * University already exists:
                 * - Check to add facebookId
                 * - Return it to the next promise
                 */
                var university = results[0];
                /*
                 * If this university was previously added to the database
                 * manually, it many not have a facebookId. If the current
                 * user has selected it from the facebook education list,
                 * we can use the opportunity to update the university.
                 */
                if (!university.get('facebookId') && education.institutionFacebookId) {
                    university.set('facebookId', education.institutionFacebookId);
                    return university.save();
                } else
                    return university;
            } else {
                /*
                 * University not found:
                 * - Create a new one
                 * - Save it and return the promise
                 */
                var University = Parse.Object.extend('University'),
                    newUniversity = new University();
                newUniversity.set('fullName', education.institutionName);
                if (education.institutionFacebookId)
                    newUniversity.set('facebookId', education.institutionFacebookId);
                return newUniversity.save();
            }
        }).then(function (university) {
            /*
             * Add university (new or old) to the user
             */
            user.set('institution', university);

            /*
             * Find the course object:
             * - It has to match the name
             * - It has to match the university
             */
            query = new Parse.Query('Course');
            query.equalTo('name', education.courseName);
            query.equalTo('institution', university);
            return query.find();
        }).then(function (results) {
            if (results.length) {
                /*
                 * Course exists:
                 * - Return it as a promise
                 */
                var course = results[0];
                if (!course.get('institutionFacebookId') && education.institutionFacebookId) {
                    course.set('institutionFacebookId', education.institutionFacebookId)
                    return course.save();
                } else
                    return course;
            } else {
                /*
                 * Create does not exist:
                 * - Create a new course
                 * - Save it and return the promise
                 */
                var Course = Parse.Object.extend('Course'),
                    newCourse = new Course();
                newCourse.set('name', education.courseName);
                newCourse.set('institution', user.get('institution'));
                if (education.courseFacebookId)
                    newCourse.set('facebookId', education.courseFacebookId);
                if (education.courseLength)
                    newCourse.set('courseLength', education.courseLength);
                if (education.institutionFacebookId)
                    newCourse.set('institutionFacebookId', education.institutionFacebookId);
                return newCourse.save();
            }
        }).then(function (course) {
            /*
             * Set new or old course on user.
             * Finally, also set yearNumber on
             * user and save the user.
             */
            user.set('course', course);
            user.set('yearNumber', education.yearNumber);
            return user.save();
        }).then(function () {
            /*
             * Success response,
             * return course and university
             * objects for client app to
             * use without calling a user
             * update.
             */
            response.success({course: user.get('course'), university: user.get('institution')});
        });
});

Parse.Cloud.define("followUser", function (request, response) {
    if (!request.user) {
        response.error({"status": "unauthorised"});
        return;
    }

    Parse.Cloud.useMasterKey();
    var mainUser = request.user,
        userToFollow,
        query = new Parse.Query(Parse.User);

    query.get(request.params.userIdToFollow)
        .then(function (result) {
            userToFollow = result;
            var relation = mainUser.relation('following');
            relation.add(userToFollow);
            mainUser.save();

            relation = userToFollow.relation('followers');
            relation.add(mainUser);
            return userToFollow.save();
        }).then(function () {
            var query = new Parse.Query(Parse.Installation);
            query.equalTo('user', userToFollow);
            Parse.Push.send({
                where: query,
                data: {
                    alert: "" + userToFollow.get('name') + " started following you!",
                    badge: "Increment",
                    sound: "default.caf",
                    title: "MyCQs new follower"
                }
            });
            response.success({numberFollowing: mainUser.get('numberFollowing'),
                numberOfFollowers: userToFollow.get('numberOfFollowers')});
        });
});


Parse.Cloud.define('unfollowUser', function (request, response) {
    if (!request.user)
        response.error({"status": "unauthorised"});

    Parse.Cloud.useMasterKey();
    var mainUser = request.user,
        userToUnfollow,
        query = new Parse.Query(Parse.User);

    query.get(request.params.userIdToUnfollow)
        .then(function (result) {
            userToUnfollow = result;

            var relation = mainUser.relation('following');
            relation.remove(userToUnfollow);
            mainUser.save();

            relation = userToUnfollow.relation('followers');
            relation.remove(mainUser);
            userToUnfollow.save();

            response.success();
        });
});

Parse.Cloud.define('bulkFollowUsers', function (request, response) {
    if (!request.user)
        response.error({"status": "unauthorised"});

    Parse.Cloud.useMasterKey();
    var mainUser = request.user,
        usersToFollow,
        query = new Parse.Query(Parse.User);

    query.containedIn('objectId', request.params.userIdsToFollow);
    query.find()
        .then(function (results) {
            usersToFollow = results;
            var relation = mainUser.relation('following');
            relation.add(usersToFollow);
            mainUser.save();
            return query.each(function (user) {
                var relation = user.relation('followers');
                relation.add(mainUser);
                user.save();
            });
        }).then(function () {
            response.success();
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
/**
 * ------------------
 * generateSearchTags
 * ------------------
 * Used for indexing objects by splitting titles, names, etc into
 * a string array without 'stop words' such as
 * 'the, of, and'. Array is saved in 'tags' and
 * should be queried like so:
 * where: { "tags": { "$all" : ["user's", "search", "terms"] } }
 *
 * @param className
 * @param object
 * @returns [tags]
 */
var generateSearchTags = function (className, object) {
    var toLowerCase = function (w) {
        return w.toLowerCase();
    };
    var words = "";
    switch (className) {
        case 'Test':
            words += object.get('title') + object.get('description');
            break;
        case 'InstitutionList':
            words += object.get('fullName');
            break;
        case 'CourseList':
            words += object.get('name');
            break;
    }
    words = words.split(/\b/);
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
 * @param object (optional)
 * @returns {*}
 */
var slugify = function (className, string, object) {
    var slug;
    switch (className) {
        case "_User":
            var firstInitial = string.charAt(0),
                lastName = string.split(" ")[string.split(" ").length - 1];
            slug = (firstInitial + lastName).toLowerCase();
            break;
        case "Category":
            if (string.toLowerCase() === "other") {
                slug = object.get('parent').get('slug') + "-" +
                    string.toLowerCase().replace(/ /g, '-').replace(/[-]+/g, '-').replace(/[^\w-]+/g, '');
            } else
                slug = string.toLowerCase().replace(/ /g, '-').replace(/[-]+/g, '-').replace(/[^\w-]+/g, '');
            break;
        default:
            slug = string.toLowerCase().replace(/ /g, '-').replace(/[-]+/g, '-').replace(/[^\w-]+/g, '');
            break;
    }
    return slug;
}

/**
 * --------------
 * capitaliseFirstLetter
 * --------------
 * @param string
 * @returns {string}
 */
function capitaliseFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
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
    if (user.isNew() && user.get('name') && user.get('name').length) {
        /*
         * Create a unique slug
         */
        var slug = slugify('_User', user.get('name'));
        /*
         * Check if slug is unique before saving
         */
        var query = new Parse.Query(Parse.User);
        query.startsWith('slug', slug);
        query.count().then(function (count) {
            if (!count)
                user.set('slug', slug);
            else
                user.set('slug', slug + (count + 1));

        })
            .then(function () {
                /*
                 * Get cover photo url
                 */
                if (!user.get('coverImageURL') || !user.get('coverImageURL').length ||
                    user.get('fbid') && user.get('fbid').length) {
                    Parse.Cloud.httpRequest({
                        url: 'http://graph.facebook.com/' + user.get('fbid') + '?fields=cover',
                        success: function (httpResponse) {
                            if (httpResponse.cover && httpResponse.cover.source && httpResponse.cover.source.length)
                                user.set('coverImageURL', httpResponse.cover.source);
                            response.success();

                        },
                        error: function (httpResponse) {
                            console.error('Request failed with response code ' + httpResponse.status);
                            // No need to deter user.save() if this request fails.
                            response.success();
                        }
                    });
                }
            });
    } else if (user.get('name') && user.get('name').length) {
        var relation = user.relation('followers');
        relation.query().count()
            .then(function (count) {
                console.log("total count: " + count);
                user.set('numberOfFollowers', count);
                console.log("updating folloowing count");
                relation = user.relation('following');
                return relation.query().count();
            }).then(function (count) {
                console.log("To " + count);
                user.set('numberFollowing', count);
                console.log("Saving");
                response.success();
            });
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
Parse.Cloud.afterSave("_User", function (request, response) {
    Parse.Cloud.useMasterKey();
    if (!request.object.get('name') && !request.object.get('name').length) {
        response.success();
        return;
    }
    /*
     * Joined MyCQs action
     */
    if (!request.object.existed()) {
        var Action = Parse.Object.extend('Action');
        var action = new Action();
        action.set('user', request.object);
        action.set('type', 'joinedMyCQs');
        action.save().then(function () {
        });
    }
    var query = new Parse.Query(Parse.User);
    query.get(request.object.id, function (user) {
        if (user.get("email").length > 0 && !user.get("welcomeEmailSent")) {
            sendEmail("welcome-email", user);
            user.set("welcomeEmailSent", true);
            user.save();
        }
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
    if (!request.object.get('title')) {
        response.error("Title of the test is required!");
        return;
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
    }).then(function (tests) {
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

            action.set("ACL", request.object.get("ACL"));
            action.set('user', author);
            action.set('test', request.object);
            action.set('type', 'testCreated');
            action.save();
        }
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
 * IF user is set:
 * - Create an Action object for User 'attemptFinished'
 * - Replace this attempt in the User's latestAttempts pointers for this test
 */
Parse.Cloud.beforeSave("Attempt", function (request, response) {

    if (request.object.isNew() && request.object.get('user')) {
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
    if (!request.object.get('score') || request.object.get('isProcessed')) {
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
            if (request.object.get('user') && test.get('author').id !== request.object.get('user').id) {
                test.get('author').increment('communityNumberOfAttempts');
                var communityAverageScore = test.get('author').get('communityAverageScore');
                if (!communityAverageScore)
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
    /*
     * Converts score to a float and
     * round to max 2.dp
     */
    var score = +parseFloat(request.object.get('score')).toFixed(2);
    action.set('value', score);
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
        if (!averageScore)
            averageScore = 0;
        var totalScoreProjection = averageScore * user.get('numberOfAttempts');
        totalScoreProjection += request.object.get('score');
        user.set('averageScore', Math.round(totalScoreProjection / user.get('numberOfAttempts')));
        if (!previousAttemptFound) {
            /*
             * This is a unique attempt
             * Increment numberOfUniqueAttempts and
             * update uniqueAverageScore score for user
             */
            user.increment('numberOfUniqueAttempts');
            var uniqueAverageScore = user.get('uniqueAverageScore');
            if (!uniqueAverageScore)
                uniqueAverageScore = 0;
            var totalUniqueScoreProjection = uniqueAverageScore * user.get('numberOfUniqueAttempts');
            totalUniqueScoreProjection += request.object.get('score');
            user.set('uniqueAverageScore', Math.round(totalUniqueScoreProjection / user.get('numberOfUniqueAttempts')));
        }
        user.save();
    });

    request.object.set('isProcessed', true);
    response.success();
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