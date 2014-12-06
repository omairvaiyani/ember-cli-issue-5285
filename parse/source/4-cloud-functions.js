/*
 * SIGN UP LOGIC
 */
/**
 * ---------------
 * preSignUp
 * ---------------
 * Generates a random username for a particular email
 * and returns the UserPrivate object that will contain
 * the email.
 *
 * Request params:
 * @param {String} email
 * @returns {Object} {privateData: {email, username} }
 */
Parse.Cloud.define("preSignUp", function (request, response) {
    Parse.Cloud.useMasterKey();
    var email = request.params.email,
        randomUsername = generateRandomString(25, "aA#");

    if (!email && !email.length) {
        response.error(Parse.Error.EMAIL_MISSING);
        return;
    }

    var query = new Parse.Query("UserPrivate");
    query.equalTo('email', email);
    query.find().then(function (result) {
        if (result[0]) {
            return null;
        } else {
            var privateData = new Parse.Object("UserPrivate");
            privateData.set('email', email);
            privateData.set('username', randomUsername);
            /*
             * ACL is set on this object on _User.beforeSave.isNew()
             */
            return privateData.save();
        }
    }).then(function (privateData) {
        if (!privateData) {
            response.error(Parse.Error.EMAIL_TAKEN);
        } else {
            response.success({"privateData": privateData});
        }
        return;
    });

});
/**
 * ---------------
 * preLogIn
 * ---------------
 * Returns the username attached
 * to the hidden email provided
 *
 * Request params:
 * @param {String} email
 * @returns {String} username
 */
Parse.Cloud.define("preLogIn", function (request, response) {
    Parse.Cloud.useMasterKey();
    var email = request.params.email;

    if (!email && !email.length) {
        response.error(Parse.Error.EMAIL_MISSING);
        return;
    }
    var query = new Parse.Query("UserPrivate");
    query.equalTo('email', email);
    query.find().then(function (result) {
        if (!result[0]) {
            response.error(Parse.Error.EMAIL_NOT_FOUND);
        } else {
            response.success({"username": result[0].get('username')});
        }
        return;
    });
});
/**
 * ---------------
 * preFacebookConnect
 * ---------------
 * Checks if a user with the
 * authResponse.userID (fbid)
 * has been migrated over manually.
 * If so, authorise the user,
 * thus allowing the client app
 * to continue the facebook connect
 * function as per usual.
 *
 * Request params:
 * @param {Object} authResponse
 * @returns {response.success} or {response.error}
 */
Parse.Cloud.define("preFacebookConnect", function (request, response) {
    Parse.Cloud.useMasterKey();
    var authResponse = request.params.authResponse,
        query = new Parse.Query(Parse.User);
    console.log("Pre Facebook connect for fbid " + authResponse.userID);
    query.equalTo('fbid', authResponse.userID);
    query.find()
        .then(function (results) {
            if (results)
                console.log("PFC results " + results.length);
            if (results[0]) {
                var user = results[0];
                console.log("PFC user found " + user.get('name') + " and id " + user.id);
                if (user.get('authData')) {
                    console.log("PFC user authData found, success");
                    response.success();
                    return;
                } else {
                    console.log("PFC user authData not found");
                    var authData = {
                        facebook: {
                            access_token: authResponse.accessToken,
                            id: authResponse.userID,
                            expiration_date: (new Date(2032, 2, 2)).toISOString()
                        }
                    };
                    user.set('authData', authData);
                    console.log("PFC new authData set");
                    return user.save()
                        .then(function () {
                            console.log("PFC, saved user, success");
                            return response.success();
                        }, function (error) {
                            console.error("PFC ERROR " + JSON.stringify(error));
                            return response.error({message: error});
                        });
                }
            } else {
                console.log("PFC no user with FBID, success and create new user");
                return response.success();
            }
        },
        function (error) {
            console.error("PFC error with first query " + JSON.stringify(error));
            return response.error(error);
        }
    );
});
/**
 * ---------------
 * setEmailAddress
 * ---------------
 * Checks if email already belongs
 * to another user. If not, then
 * it checks if the requesting user
 * has privateData set (creates it
 * if not) and sets the given email.
 *
 * Request params:
 * @param {String} email
 * @returns {response.success} or {response.error}
 */
Parse.Cloud.define("setEmailAddress", function (request, response) {
    Parse.Cloud.useMasterKey();
    var email = request.params.email,
        user = request.user,
        query = new Parse.Query("UserPrivate");


    if (!user || !email) {
        response.error({"message": "User not authenticated or email not given."});
        return;
    }
    var privateData = user.get('privateData');

    query.equalTo('email', email);
    query.count()
        .then(
        function (count) {
            if (count) {
                response.error({"message": "Email already taken."});
                return;
            } else {
                if (!privateData) {
                    privateData = new Parse.Object("UserPrivate");
                    privateData.set('username', user.get('username'));
                }
                privateData.set('email', email);
                privateData.setACL(Security.createACLs(user, false, false, false));
                return privateData.save();
            }
        },
        function (error) {
            response.error(error);
            return;
        }
    )
        .then(function (privateData) {
            user.set('privateData', privateData);
            return user.save();
        })
        .then(function () {
            response.success({"privateData": privateData});
            return;
        });
});
/**
 * --------------------
 * resetPasswordRequest
 * --------------------
 * A custom password reset
 * function given that we
 * are not storing 'emails'
 * on the _User class.
 *
 * Sends a request email with
 * a unique link (the objectId
 * for the PasswordReset object).
 *
 * Request params:
 * @param {String} email
 * @returns {response.success} or {response.error}
 */
Parse.Cloud.define("resetPasswordRequest", function (request, response) {
    Parse.Cloud.useMasterKey();
    var email = request.params.email,
        query = new Parse.Query("UserPrivate"),
        user;


    if (!email) {
        return response.error(Parse.Error.EMAIL_MISSING);
    }

    query.equalTo('email', email);
    query.find()
        .then(function (result) {
            if (result[0]) {
                var username = result[0].get('username');
                query = new Parse.Query(Parse.User);
                query.equalTo('username', username);
                return query.find();
            } else
                return;
        })
        .then(function (result) {
            if (!result[0]) {
                return;
            } else {
                user = result[0];
                var passwordResetObject = new Parse.Object('PasswordReset');
                passwordResetObject.set('user', user);
                passwordResetObject.set('isValid', true);
                passwordResetObject.setACL(Security.createACLs());
                return passwordResetObject.save();
            }
        })
        .then(function (passwordResetObject) {
            if (passwordResetObject) {
                var data = [
                    {
                        name: "PASSRESETLINK",
                        content: MyCQs.baseUrl + "password-reset/" + passwordResetObject.id
                    }
                ];
                return sendEmail('forgotten-password', user, email, data);
            } else
                return;
        })
        .then(function (emailSent) {
            if (!emailSent) {
                console.error("Email not sent");
                response.error(Parse.Error.EMAIL_NOT_FOUND);
            } else {
                response.success();
            }
        },
        function (error) {
            if (error)
                response.error(error);
            else
                response.error();
        });
});
/**
 * -----------------------------
 * validatePasswordResetRequest
 * ---------------------------
 * Checks if password request
 * is valid.
 *
 * Request params:
 * @param {String} objectId
 * @returns {_User} or {response.error}
 */
Parse.Cloud.define("validatePasswordResetRequest", function (request, response) {
    Parse.Cloud.useMasterKey();
    var objectId = request.params.objectId,
        query = new Parse.Query("PasswordReset");

    if (!objectId) {
        response.error(Parse.Error.MISSING_OBJECT_ID);
        return;
    }

    query.equalTo('objectId', objectId);
    return query.find()
        .then(
        function (result) {
            if (result[0]) {
                var passwordReset = result[0];
                if (passwordReset.get('isValid')) {
                    return response.success(passwordReset.get('user'));
                } else {
                    return response.error(Parse.Error.INVALID_LINKED_SESSION);
                }
            } else
                return response.error(Parse.Error.OBJECT_NOT_FOUND);
        });
});
/**
 * -----------------------------
 * setNewPassword
 * ---------------------------
 * Sets a new password for a user
 * IF they provide a valid password
 * reset request
 * Request params:
 * @param {String} userObjectId
 * @param {String} password
 * @param {String} passwordResetId
 * @returns {response.success} or {response.error}
 */
Parse.Cloud.define("setNewPassword", function (request, response) {
    Parse.Cloud.useMasterKey();
    var userObjectId = request.params.userObjectId,
        password = request.params.password,
        passwordResetId = request.params.passwordResetId,
        query = new Parse.Query("PasswordReset");

    if (!userObjectId || !password || !passwordResetId) {
        response.error(Parse.Error.MISSING_OBJECT_ID);
        return;
    }

    query.equalTo('objectId', passwordResetId);
    return query.find()
        .then(
        function (result) {
            if (result[0]) {
                var passwordReset = result[0];
                if (passwordReset.get('isValid')) {
                    passwordReset.set('isValid', false);
                    passwordReset.save()
                        .then(function () {
                            query = new Parse.Query(Parse.User);
                            query.equalTo('objectId', userObjectId);
                            return query.find();
                        })
                        .then(function (user) {
                            user[0].set('password', password);
                            return user[0].save();
                        }).
                        then(function () {
                            response.success();
                        });
                } else {
                    return response.error(Parse.Error.INVALID_LINKED_SESSION);
                }
            } else
                return response.error(Parse.Error.OBJECT_NOT_FOUND);
        });
});

/***
 Sends a push message to the user (currently only used for Send to Mobile function, but potential to be rolled out to others
 @param {String} message A message to send with the push, i.e. 'You sent a test to your mobile' etc
 @param {String} recipientUserId objectId of the user to receive the message (in Send to Mobile this will be the current user)
 @param {String} actionName e.g. take-test
 @param {Array} actionParams e.g. [{name:test (testId), content:type (send-to-mobile)}, ...]
 @param {String} sound e.g. srs. Default is 'default'
 **/

Parse.Cloud.define("sendPushToUser", function (request, response) {
    var senderUser = request.user,
        recipientUserId = request.params.recipientUserId,
        message = request.params.message,
        actionName = request.params.actionName,
        actionParams = request.params.actionParams,
        sound = request.params.sound,
        sentToSelf = 0;

    if (senderUser && senderUser.id === recipientUserId) {
        sentToSelf = 1;
    }
    // Validate the message text.
    // For example make sure it is under 140 characters
    if (message.length > 140) {
        // Truncate and add a ...
        message = message.substring(0, 137) + "...";
    }

    var actionUrl = "mycqs://" + actionName;

    /* Avoid crashing until we have all instances
     * of sendPushToUser updated to this method.
     */
    if (!actionParams)
        actionParams = [];
    else
        console.log("Action params " + JSON.stringify(actionParams));

    if(actionParams.name) {
        actionUrl += "?" + actionParams[0].name + "=" + actionParams[0].content;
        if (actionParams.length > 0) {
            for (var i = 1; i < actionParams.length; i++) {
                actionUrl += "&" + actionParams[i].name + "=" + actionParams[i].content;
            }
        }
    }

    if (!sound)
        sound = 'default';

    console.log("Sound for push is " + sound);

    // Send the push.
    // Find devices associated with the recipient user
    var query = new Parse.Query(Parse.User);
    query.get(recipientUserId)
        .then(function (recipientUser) {
            var pushQuery = new Parse.Query(Parse.Installation);
            pushQuery.equalTo("user", recipientUser);

            // Send the push notification to results of the query
            return Parse.Push.send({
                where: pushQuery,
                data: {
                    "title": "MyCQs",
                    "alert": message,
                    "url": actionUrl,
                    "sound": sound + ".caf",
                    "badge": "Increment",
                    "sentToSelf": sentToSelf
                }
            });
        }, function (error) {
            console.error("Error on sending push. User not found: " + JSON.stringify(error));
        })
        .then(function () {
            response.success("Push was sent successfully.")
        }, function (error) {
            response.error("Push failed to send with error: " + JSON.stringify(error));
        });
});

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
        response.error("unauthorised");
        return;
    }
    Parse.Cloud.useMasterKey();
    var mainUser = request.user,
        userToFollow,
        query = new Parse.Query(Parse.User);

    return query.get(request.params.userIdToFollow)
        .then(function (result) {
            userToFollow = result;

            var relation = userToFollow.relation('followers');
            relation.add(mainUser);
            return userToFollow.save();
        }).then(function () {
            var relation = mainUser.relation('following');
            relation.add(userToFollow);
            return mainUser.save();
        }).then(function () {
            var query = new Parse.Query(Parse.Installation);
            query.equalTo('user', userToFollow);
            Parse.Push.send({
                where: query,
                data: {
                    alert: mainUser.get('name') + " started following you!",
                    badge: "Increment",
                    sound: "default.caf",
                    title: "MyCQs new follower",
                    userId: mainUser.id,
                    userName: mainUser.get('name'),
                    pushType: "newFollower"
                }
            });
            if (!mainUser.get('authData') || !userToFollow.get('graphObjectId')) {
                return;
            }
            /*
             * Share 'follow' user action on graph api
             */
            return Parse.Cloud.httpRequest({
                method: 'POST',
                url: FB.API.url + 'og.follows',
                params: {
                    access_token: mainUser.get('authData').facebook.access_token,
                    profile: userToFollow.get('graphObjectId')
                }
            });
        }).then(
        function (httpResponse) {
            var graphActionId;
            if (httpResponse && httpResponse.data)
                graphActionId = httpResponse.data.id;
            return response.success({
                graphActionId: graphActionId,
                numberFollowing: mainUser.get('numberFollowing'),
                numberOfFollowers: userToFollow.get('numberOfFollowers')
            });
        },
        function () {
            return response.success({
                numberFollowing: mainUser.get('numberFollowing'),
                numberOfFollowers: userToFollow.get('numberOfFollowers')
            });
        }
    );
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

            var relation = userToUnfollow.relation('followers');
            relation.remove(mainUser);
            return userToUnfollow.save();
        }).then(function () {
            var relation = mainUser.relation('following');
            relation.remove(userToUnfollow);
            return mainUser.save();
        }).then(function () {
            response.success();
        });
});

Parse.Cloud.define('bulkFollowUsers', function (request, response) {
    if (!request.user) {
        response.error("unauthorised");
        return;
    }
    Parse.Cloud.useMasterKey();
    var mainUser = request.user,
        usersToFollow,
        query = new Parse.Query(Parse.User);

    query.containedIn('objectId', request.params.userIdsToFollow);
    return query.find()
        .then(function (results) {
            usersToFollow = results;
            var relation = mainUser.relation('following');
            relation.add(usersToFollow);
            return mainUser.save();
        })
        .then(function () {
            return query.each(
                function (user) {
                    var relation = user.relation('followers');
                    relation.add(mainUser);
                    user.save();
                });
        })
        .then(function () {
            return response.success();
        }, function (error) {
            return response.error(error);
        }
    );
});

/**
 * ------------
 * isMobileUser
 * ------------
 * Clients cannot query Parse.Installation
 * Hence, this function will return true
 * or false for clients.
 */

Parse.Cloud.define('isMobileUser', function (request, response) {
    Parse.Cloud.useMasterKey();
    var query = new Parse.Query(Parse.Installation);
    if (request.user)
        query.equalTo('user', request.user);
    else if (request.params.userId) {
        query.equalTo('user', request.params.id);
    } else {
        return response.error("User or UserId not set.");
    }
    query.count()
        .then(function (count) {
            if (count)
                response.success(true);
            else
                response.success(false);
        });
});
/**
 * -----------------------
 * getInstallationsForUser
 * -----------------------
 * Checks if the user has an installed device
 * and returns all installations
 */

Parse.Cloud.define('getInstallationsForUser', function (request, response) {
    if (!request.user) {
        response.error("No user set.");
        return;
    }

    Parse.Cloud.useMasterKey();
    var query = new Parse.Query(Parse.Installation);
    query.equalTo('user', request.user);
    query.find()
        .then(function (results) {
            response.success(results);
        });
});

Parse.Cloud.define("findTestsForModule", function (request, response) {
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
/**
 * @Cloudfunction Retrive a list of Stripe Plans
 * - Default limit = 10
 * - Annoyingly, Parse has tinkered with Stripe
 * and added their own iteration of the module.
 * Which doesn't seem to let us change the limit.
 */
Parse.Cloud.define('listStripePlans', function (request, response) {
    Stripe.Plans.list(100, 0, {
        success: function (httpResponse) {
            response.success(JSON.stringify(httpResponse.data));
        },
        error: function (error) {
            response.error(JSON.stringify(error));
        }
    });
});
/**
 * @Cloudfunction Create a Stripe customer
 * Our premium subscriptions will be handled
 * with Stripe for web users.
 * - Receives card token
 * - Creates customer
 * - Updates user's private data with stripe token
 * - Activates user's spacedRepition properties
 */
Parse.Cloud.define("createSRSCustomer", function (request, response) {
    Parse.Cloud.useMasterKey();

    var user = request.user,
        stripeObject,
        stripeToken,
        customerId,
        privateData,
        promises = [];

    if (!user)
        return response.error("User not set!");

    Stripe.Customers.create({email: request.params.email, card: request.params.card})
        .then(function (httpResponse) {
            console.log("Stripe response " + JSON.stringify(httpResponse));
            customerId = httpResponse.id;
            stripeObject = httpResponse;
            stripeToken = stripeObject.id;
            privateData = user.get('privateData');
            return privateData.fetch();
        }).then(function () {
            privateData.set('stripeObject', stripeObject);
            privateData.set('stripeToken', stripeToken);
            return privateData.save();
        }).then(function () {
            response.success({"customerId": customerId});
        }, function (error) {
            response.error(JSON.stringify(error));
        });
});
/**
 * @CloudFunction Subscribe a Stripe customer to SRS
 * @param {String} customerId Stripe cus_id
 * @param {String} planId Stripe plan_id
 */
Parse.Cloud.define("subscribeCustomerToSRS", function (request, response) {
    Parse.Cloud.useMasterKey();
    var user = request.user,
        customerId = request.params.customerId,
        planId = request.params.planId;

    if (!user || !customerId || !planId)
        return response.error("User, customerId or planId is not set");

    user.get('privateData').fetch()
        .then(function () {
            return Stripe.Customers.updateSubscription(customerId, {"plan": planId});
        })
        .then(function (httpResponse) {
            console.log("Subscription " + JSON.stringify(httpResponse));
            var stripeSubscription = httpResponse,
            //privateData = user.get('privateData'),
            //startDate = new moment(),
                trialStartDate = new moment(),
            //expiryDate = new moment().add(subscription.plan.trial_period_days, 'day')
            //  .add(subscription.plan.interval_count, subscription.plan.interval),
                trialExpiryDate = new moment().add(stripeSubscription.plan.trial_period_days, 'day');

            return Parse.Cloud.run('activateSRSforUser', {
                interval: stripeSubscription.plan.interval,
                intervalLength: stripeSubscription.plan.interval_count,
                signupSource: "Web",
                activationKey: "pacRe6e8rUthusuDEhEwUPEWrUpruhat",
                stripeSubscription: stripeSubscription,
                trialStartDate: trialStartDate,
                trialExpiryDate: trialExpiryDate
            });

            /*privateData.set('stripeSubscription', subscription);
             privateData.set('spacedRepetitionActivated', true);

             privateData.set('spacedRepetitionTrialStartDate', trialStartDate._d);
             privateData.set('spacedRepetitionTrialExpiryDate', trialExpiryDate._d);

             privateData.set('spacedRepetitionStartDate', startDate._d);
             privateData.set('spacedRepetitionExpiryDate', expiryDate._d);
             privateData.set('spacedRepetitionLastPurchase', subscription.plan.interval_count + " " + subscription.plan.interval);
             privateData.set('spacedRepetitionSignupSource', 'Web');
             return privateData.save();*/
        }).then(function (result) {
            response.success({"privateData": result.privateData});

        },
        function (error) {
            response.error(JSON.stringify(error));
        });
});
/**
 * @CloudFunction Activate SRS for User
 * Either called from iOS, from the
 * CloudFunction after subscribing stripe
 * usersor from CloudFundtion redeemPromoCode.
 *
 * Also creates an SRS test for the user
 * if one doesn't already exist.
 *
 * Never called directly from Web as
 * activationKey will be seen in Javascript code.
 *
 * @param {String} interval e.g. month, year
 * @param {Integer} intervalLength e.g. 6
 * @param {String} signupSource e.g. iOS, Web
 * @param {Object} stripeSubscription (Web only)
 * @param {Date} trialStartDate (Web only)
 * @param {Date} trialExpiryDate (Web only)
 * @param {String} activationKey, expects pacRe6e8rUthusuDEhEwUPEWrUpruhat
 */
Parse.Cloud.define('activateSRSforUser', function (request, response) {
    Parse.Cloud.useMasterKey();
    // We need a unique token for iAP that can be verified
    var user = request.user,
        interval = request.params.interval,
        intervalLength = request.params.intervalLength,
        signupSource = request.params.signupSource,
        activationKey = request.params.activationKey,
        stripeSubscription = request.params.stripeSubscription,
        trialStartDate = request.params.trialStartDate,
        trialExpiryDate = request.params.trialExpiryDate,
        privateData,
        test,
        promises = [];

    if (activationKey !== "pacRe6e8rUthusuDEhEwUPEWrUpruhat")
        return response.error("Unauthorized request.");

    if(!user) {
        if (request.params.userId) {
            user = new Parse.User();
            user.id = request.params.userId;
            promises.push(user.fetch());
        } else {
            return response.error("User is not set.");
        }
    }

    Parse.Promise.when(promises)
        .then(function () {
            return user.get('privateData').fetch();
        })
        .then(function (result) {
            privateData = result;
            var startDate = new moment(),
                expiryDate = new moment().add(intervalLength, interval);

            privateData.set('spacedRepetitionActivated', true);
            privateData.set('spacedRepetitionStartDate', startDate._d);
            privateData.set('spacedRepetitionExpiryDate', expiryDate._d);
            privateData.set('spacedRepetitionLastPurchase', intervalLength + " " + interval);
            privateData.set('spacedRepetitionSignupSource', signupSource);
            privateData.set('spacedRepetitionSubscriptionCancelled', false);
            if (trialStartDate && trialStartDate) {
                privateData.set('spacedRepetitionTrialStartDate', trialStartDate._d);
                privateData.set('spacedRepetitionTrialExpiryDate', trialExpiryDate._d);
            }
            if (stripeSubscription)
                privateData.set('stripeSubscription', stripeSubscription);
            promises.push(privateData.save());
            if (!user.get('spacedRepetitionIntensity'))
                user.set('spacedRepetitionIntensity', 1);
            if (!user.get('spacedRepetitionMaxQuestions'))
                user.set('spacedRepetitionMaxQuestions', 10);
            if (!user.get('spacedRepetitionNotificationByEmail') &&
                user.get('spacedRepetitionNotificationByEmail') !== false)
                user.set('spacedRepetitionNotificationByEmail', true);
            if (!user.get('spacedRepetitionNotificationByPush') &&
                user.get('spacedRepetitionNotificationByPush') !== false)
                user.set('spacedRepetitionNotificationByPush', true);
            promises.push(user.save());
            // See if the user has an SRS test already
            var query = new Parse.Query('Test');
            query.equalTo('author', user);
            query.equalTo('isSpacedRepetition', true);
            return query.find();
        }).then(function (results) {
            if (!results[0]) {
                // Create a new SRS test
                var Test = Parse.Object.extend('Test');
                test = new Test();
                test.set('isGenerated', true);
                test.set('isSpacedRepetition', true);
                test.set('author', user);
                test.set('title', "Spaced Repetition Test");
                test.set('privacy', 0);
                test.set('questions', []);
                var Category = Parse.Object.extend('Category'),
                    srCategory = new Category();
                srCategory.id = "jWx56PKQzU"; // Spaced Repetition is a Category
                test.set('category', srCategory);
                var ACL = new Parse.ACL();
                ACL.setReadAccess(user.id, true);
                test.setACL(ACL);
                query = new Parse.Query('UniqueResponse');
                query.equalTo('user', user);
                query.descending('updatedAt');
                query.limit(250);
                return query.find();
            }
        }).then(function (uniqueResponses) {
            if (uniqueResponses) {
                for (var i = 0; i < uniqueResponses.length; i++) {
                    test.get('questions').push(uniqueResponses[i].get('question'));
                }
                promises.push(test.save());
            }
            return Parse.Promise.when(promises);
        }).then(function () {
            response.success({"privateData": privateData});
        }, function (error) {
            response.error(JSON.stringify(error));
        });
});
/**
 * @CloudFunction unsubscribeUserFromStripePlan
 * Currently only used for cancelling SRS subscriptions
 */
Parse.Cloud.define('unsubscribeUserFromStripePlan', function (request, response) {
    Parse.Cloud.useMasterKey();
    // We need a unique token for iAP that can be verified
    var user = request.user;

    if (!user)
        return response.error("Unauthorized request.");

    var privateData = user.get('privateData');

    privateData.fetch()
        .then(function () {
            var subscription = privateData.get('stripeSubscription');
            if (subscription) {
                return Stripe.Customers.cancelSubscription(privateData.get('stripeToken'),
                    subscription.id);
            } else {
                return;
            }
        }).then(function (httpResponse) {
            privateData.set('stripeSubscription', {});
            privateData.set('spacedRepetitionSubscriptionCancelled', true);
            return privateData.save();
        }, function (error) {
            return error;
        }).then(function () {
            response.success();
        }, function (error) {
            response.error(JSON.stringify(error));
        });
});
/**
 * @CloudFunction Get next due time for SRS for user
 * Abstraction function to calculate the nextDue
 * time for a user who has SRS, for their local time.
 *
 * Currently used by afterSave on SRS attempts.
 * Either send:
 * @param userId {String}
 * or:
 * @param data {Object} {intensityLevelConfig, timeZone}
 */
Parse.Cloud.define('getSpacedRepetitionNextDueForUser', function (request, response) {
    Parse.Cloud.useMasterKey();
    var user,
        userId = request.params.userId,
        data = request.params.data,
        intensityLevelConfig,
        timeZone,
        promises = [];

    if (data) {
        intensityLevelConfig = data.intensityLevelConfig;
        timeZone = data.timeZone;
    } else if (userId) {
        /* Create a promise which
         * gets us the user and their
         * timeZone. Finally,
         * fetch the intensityLevel
         * config.
         */
        var query = new Parse.Query(Parse.User);
        promises.push(query.get(userId)
                .then(function (result) {
                    user = result;
                    if (!user.get('timeZone')) {
                        query = new Parse.Query(Parse.Installation);
                        query.equalTo('user', user);
                        return query.find();
                    } else {
                        timeZone = user.get('timeZone');
                        return;
                    }
                })
                .then(function (installations) {
                    if (installations && installations[0])
                        timeZone = installations[0].get('timeZone');
                    return Parse.Config.get();
                })
                .then(function (config) {
                    intensityLevelConfig = config.get("spacedRepetitionIntensityLevels")
                        [user.get('spacedRepetitionIntensity') - 1];
                    return;
                })
        );
    } else {
        // Neither data or userId set.
        return response.error("Please set either a userId or data.intensityLevelConfig and data.timeZone");
    }
    /* At this point, either we have all the information
     * we need from the request.params.data, or we have to wait
     * for the promises above to resolve.
     */
    Parse.Promise.when(promises)
        .then(function () {
            /* All the info we need to calculate nextDue is here.
             * Therfore, outsourcing this local calculation to a
             * function, so that it can be called from other jobs
             * synchronously.
             */
            var nextDue = getNextDueTimeForSRSTest(intensityLevelConfig, timeZone);
            response.success(nextDue._d);
        }, function (error) {
            response.error(JSON.stringify(error));
        });
});
/**
 * @CloudFunction Append Questions to SRS Test
 * @name addOrRemoveQuestionsToSRSTest
 * @param {Array} questionIds
 * @param {Integer} task 0: append, 1: remove, 2: replace, 3: clear all!
 */
Parse.Cloud.define('addOrRemoveQuestionsToSRSTest', function (request, response) {
    Parse.Cloud.useMasterKey();
    var user = request.user,
        questionIds = request.params.questionIds,
        task = request.params.task,
        updatedQuestionsList = [];

    if (!user || !questionIds)
        return response.error("User, SRS Test or Questions not set");

    var query = new Parse.Query('Test');
    query.equalTo('author', user);
    query.equalTo('isSpacedRepetition', true);
    query.include('questions');
    query.find()
        .then(function (tests) {
            var srTest = tests[0];
            var oldQuestionsList = srTest.get('questions');

            switch (task) {
                case 0: // Append questions
                    console.log(2);
                    /*
                     * Add unique questions only
                     */
                    updatedQuestionsList = updatedQuestionsList.concat(oldQuestionsList);
                    console.log("Question list pre add " + JSON.stringify(updatedQuestionsList));
                    console.log("Old question list length " + oldQuestionsList.length);
                    var oldQuestionIds = [];
                    for (var i = 0; i < oldQuestionsList.length; i++) {
                        oldQuestionIds.push(oldQuestionsList[i].id);
                    }
                    console.log("Old questionIds length " + oldQuestionIds.length);
                    console.log("New questionIds length " + questionIds.length);
                    for (var i = 0; i < questionIds.length; i++) {
                        console.log("Should add questionId " + questionIds[i] + " to SR test?");
                        if (oldQuestionIds.indexOf(questionIds[i]) === -1) {
                            console.log("Yes");
                            var newQuestion = new Parse.Object('Question');
                            newQuestion.id = questionIds[i];
                            updatedQuestionsList.push(newQuestion);
                        } else
                            console.log("No, duplicated " + questionIds[i]);
                    }
                    break;
                case 1: // Remove
                    console.log(3);
                    /*
                     * Remove questions
                     */
                    for (var i = 0; i < oldQuestionsList.length; i++) {
                        var question = oldQuestionsList[i];
                        if (questionIds.indexOf(question.id) === -1)
                            updatedQuestionsList.push(question);
                    }
                    break;
                case 2: // Replace
                    for (var i = 0; i < questionIds.length; i++) {
                        var newQuestion = new Parse.Object('Question');
                        newQuestion.id = questionIds[i];
                        updatedQuestionsList.push(newQuestion);
                    }
                    break;
                case 3:
                    updatedQuestionsLists = [];
                    break;
            }
            console.log(4);
            srTest.set('questions', updatedQuestionsList);
            return srTest.save();
        }).then(function () {
            console.log(5 + "Test saved");
            ;
            response.success("Test saved, " + questionIds.length + " added!");
        }, function (error) {
            response.error(JSON.stringify(error));
        });
});

/**
 * @CloudFunction - PromoCode Redemption
 * Checks for validity of an entered promo code
 * @param {String} code
 * @param {String} source e.g. iOS, Web
 */
Parse.Cloud.define('redeemPromoCode', function (request, response) {
    Parse.Cloud.useMasterKey();

    var user = request.user,
        query = new Parse.Query('PromoCode'),
        promises = [],
        errorMessage,
        successMessage,
        promotionalCode;

    if (!user)
        return response.error("You must be logged in to redeem a code. Cheeky!");

    user.fetch('privateData')
        .then(function () {
            query.equalTo('code', request.params.code);
            return query.find();
        })
        .then(function (result) {
            if (!result || !result[0]) {
                errorMessage = "Please enter a valid promotional code";
            } else {
                promotionalCode = result[0];

                if (promotionalCode.get('maximumNumberOfUses') <= promotionalCode.get('numberOfRedemptions')
                    && !promotionalCode.get('isInfinite')) {
                    // promo code is used up
                    errorMessage = "Sorry but this code is no longer valid!";
                } else if (!promotionalCode.get('isActive')) {
                    // code has expired
                    errorMessage = "Sorry but this code is no longer active!";
                } else {
                    // code is valid
                    promotionalCode.increment('numberOfRedemptions');
                    promises.push(promotionalCode.save());
                    if (promotionalCode.get('action') === 'SRS-1-Month-Trial') {
                        successMessage = "Your Spaced Repetition Service is now activated for 1 month!";
                        return Parse.Cloud.run('activateSRSforUser', {
                            interval: 'month',
                            intervalLength: 1,
                            signupSource: request.params.source,
                            activationKey: "pacRe6e8rUthusuDEhEwUPEWrUpruhat",
                            userId: user.id
                        });
                    }
                }
            }
        })
        .then(
        function (activationResponse) {
            if (errorMessage)
                return response.error(errorMessage);
            else if (activationResponse) {
                return response.success(successMessage);
            }
        }, function (error) {
            return response.error(error.message);
        });

});
/**
 * @CloudFunction - Get SRS Test for User
 * This is particular useful for new subscribers,
 * it generates an SRS test if one does not exist
 */
Parse.Cloud.define('getSRSTestForUser', function (request, response) {
    Parse.Cloud.useMasterKey();

    var user = request.user,
        query = new Parse.Query('Test'),
        srsTest;

    query.equalTo('author', user);
    query.equalTo('isSpacedRepetition', true);
    query.find()
        .then(function (results) {
            if (results[0])
                srsTest = results[0];
            else {
                srsTest = new Parse.Object('Test');
                srsTest.set('isGenerated', true);
                srsTest.set('isSpacedRepetition', true);
                srsTest.set('author', user);
                srsTest.set('title', "Spaced Repetition Test");
                srsTest.set('privacy', 0);
                srsTest.set('questions', []);
                var Category = Parse.Object.extend('Category'),
                    srCategory = new Category();
                srCategory.id = "jWx56PKQzU"; // Spaced Repetition is a Category
                srsTest.set('category', srCategory);
                var ACL = new Parse.ACL();
                ACL.setReadAccess(user.id, true);
                srsTest.setACL(ACL);
                return srsTest.save();
            }
        })
        .then(function () {
            return response.success(srsTest);
        }, function (error) {
            return response.error(error);
        });
});

Parse.Cloud.define('generateSitemapForTests', function (request, response) {
    var query = new Parse.Query('Test'),
        limit = request.params.limit,
        skip = request.params.skip,
        priority = request.params.priority,
        frequency = request.params.frequency,
        sitemapUrls = "";

    if (!limit)
        limit = 1000;
    if (!priority)
        priority = 0.9;
    if (!frequency)
        frequency = "daily";

    query.equalTo('privacy', 1);
    query.limit(limit);
    if (skip)
        query.skip(skip);
    query.descending('quality');
    query.find().then(function (tests) {
        for (var i = 0; i < tests.length; i++) {
            var test = tests[i];
            if (!test || !test.get('slug') || !test.get('slug').length)
                continue;
            var url = "http://mycqs.com/test/" + test.get('slug').trim();
            sitemapUrls += createSitemapNodeForUrl(url, priority, frequency, test.updatedAt);
        }
        response.success(sitemapUrls);
    }, function (error) {
        response.error(JSON.stringify(error));
    });
});