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
    query.equalTo('email', email.toLowerCase());
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

    if (actionParams.name) {
        actionUrl += "?" + actionParams[0].name + "=" + actionParams[0].content;
        if (actionParams.length > 0) {
            for (var i = 1; i < actionParams.length; i++) {
                actionUrl += "&" + actionParams[i].name + "=" + actionParams[i].content;
            }
        }
    }
    if (!sound)
        sound = 'default';
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
            response.error(error);
        });
});

/**
 * DEPRECATED
 * --------------------
 * updateUserEducation
 * -------------------
 * Central logic for maintaining course and
 * university objects while updating the user's
 * education pointers and info.
 *
 * NOTE - Can now be used for Groups
 * Just send:
 * @param {String} groupId
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
        user = request.user,
        groupId = request.params.groupId,
        group,
        promises = [];

    if (groupId) {
        group = new Parse.Object("Group");
        group.id = groupId;
        promises.push(group.fetch());
    }


    Parse.Promise.when(promises).then(function () {
        /*
         * Find university from institutionName
         * Otherwise create a new university object
         */
        var query = new Parse.Query('University');
        query.equalTo('fullName', education.institutionName);

        return query.find();
    }).then(function (results) {
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
        if (!group) {
            /*
             * Add university (new or old) to the user
             */
            user.set('institution', university);
        } else
            group.set('institution', university);

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
             * Course does not exist:
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
        if (!group) {
            /*
             * Set new or old course on user.
             * Finally, also set yearNumber on
             * user and save the user.
             */
            user.set('course', course);
            user.set('yearNumber', education.yearNumber);
            return user.save();
        } else {
            group.set('course', course);
            group.set('yearOrGrade', education.yearNumber);
            return group.save();
        }
    }).then(function () {
        /*
         * Success response,
         * return course and university
         * objects for client app to
         * use without calling a user
         * update.
         */
        if (!group) {
            response.success({course: user.get('course'), university: user.get('institution')});
        } else
            response.success({course: group.get('course'), institution: group.get('institution')});
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

    var educationalInstitution = new Parse.Object("EducationalInstitution"),
        studyField = new Parse.Object('StudyField'),
        promises = [];

    educationalInstitution.id = educationalInstitutionId;
    studyField.id = studyFieldId;
    promises.push(educationalInstitution.fetch());
    if (studyFieldId)
        promises.push(studyField.fetch());
    Parse.Promise.when(promises).then(function () {
        var query = new Parse.Query("EducationCohort");
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
            educationCohort = new Parse.Object("EducationCohort");
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
 * @return {EducationalInstitution} educationalInstitution
 */
Parse.Cloud.define('createOrUpdateEducationalInstitution', function (request, response) {
    var name = request.params.name,
        facebookId = request.params.facebookId,
        type = request.params.type,
        educationalInstitution;

    if (!name)
        return response.error("Please send a 'name' for the new EducationalInstitution.");

    name = capitaliseFirstLetter(name);
    var query = new Parse.Query("EducationalInstitution");
    query.equalTo('name', name);
    query.find()
        .then(function (results) {
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
                educationalInstitution = new Parse.Object("EducationalInstitution");
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

    name = capitaliseFirstLetter(name);
    var query = new Parse.Query("StudyField");
    query.equalTo('name', name);
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
                studyField = new Parse.Object("StudyField");
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
 * @return {EducationInstituion, StudyField, Integer} educationalInstitution, studyField, graduationYear
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
            if (!mainUser.get('authData') || !mainUser.get('authData').facebook
                || !mainUser.get('authData').facebook.access_token) {
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
                    profile: MyCQs.baseUrl + userToFollow.get('slug')
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
        function (error) {
            console.error(JSON.stringify(error));
            return response.success({
                graphError: error,
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
        var user = new Parse.User();
        user.id = request.params.userId;
        query.equalTo('user', user);
    } else {
        return response.error("User or UserId not set.");
    }
    query.count()
        .then(function (count) {
            if (count)
                response.success(true);
            else
                response.success(false);
        }, function (error) {
            return response.error(error);
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
/**
 * -- Deprecated --
 */
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
/**
 * -- Deprecated --
 */
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
/**
 * -- Deprecated --
 */
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
 * --Deprecated--
 *
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
 * @Cloudfunction Create a Stripe customer
 * Our premium subscriptions will be handled
 * with Stripe for web users.
 * - Receives card token
 * - Creates customer
 * - Updates user's private data with stripe token
 * IF User already has stripeToken, return that
 * instead!.
 */
Parse.Cloud.define("createStripeCustomer", function (request, response) {
    Parse.Cloud.useMasterKey();

    var user = request.user,
        privateData,
        card = request.params.card,
        stripeObject,
        stripeToken,
        promises = [];

    if (!card)
        return response.error("Please send the card details!");
    if (!user)
        return response.error("User not set!");
    privateData = user.get('privateData');
    if (!privateData)
        return response.error("User does not have privateData!");

    privateData.fetch()
        .then(function () {
            if (!privateData.get('stripeToken') || !privateData.get('stripeToken').length)
                return Stripe.Customers.create({email: request.params.email, card: request.params.card})
                    .then(function (httpResponse) {
                        stripeObject = httpResponse;
                        stripeToken = stripeObject.id;
                        privateData.set('stripeObject', stripeObject);
                        privateData.set('stripeToken', stripeToken);
                        return privateData.save();
                    });
        }).then(function () {
            response.success({"stripeToken": privateData.get('stripeToken')});
        }, function (error) {
            response.error(JSON.stringify(error));
        });
});
/**
 * -- DEPRECATED --
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
 * @CloudFunction Begin charging Stripe customer
 * @param {String} customerId Stripe cus_id
 * @param {String} planId Stripe plan_id
 */
Parse.Cloud.define("beginStripePaymentPlan", function (request, response) {
    Parse.Cloud.useMasterKey();
    var user = request.user,
        customerId = request.params.customerId,
        planId = request.params.planId;

    if (!user || !customerId || !planId)
        return response.error("User, customerId or planId is not set");

    user.get('privateData').fetch()
        .then(function () {
            var subscription = {
                    plan: planId
                },
                trial_end;

            // If already on some other promo trial
            if (user.get('privateData').get('premiumTrialExpiryDate'))
                trial_end = new moment(user.get('privateData').get('premiumTrialExpiryDate'));
            // If first time payment, offer 30 day extra trial.
            if (!user.get('privateData').get('premiumMonthTrialRedeemed')) {
                if (!trial_end)
                    trial_end = new moment();
                trial_end.add(30, 'day');
            }
            if (trial_end)
                subscription.trial_end = trial_end.toDate();
            return Stripe.Customers.updateSubscription(customerId, subscription);
        })
        .then(function (httpResponse) {
            var stripeSubscription = httpResponse,
                trialStartDate,
                trialExpiryDate;
            return Parse.Cloud.run('upgradeUserToPremium', {
                interval: stripeSubscription.plan.interval,
                intervalLength: stripeSubscription.plan.interval_count,
                signupSource: "Web",
                activationKey: "pacRe6e8rUthusuDEhEwUPEWrUpruhat",
                stripeSubscription: stripeSubscription,
                trialInterval: stripeSubscription.plan.trial_period_interval,
                trialLength: stripeSubscription.plan.trial_period_days,
                userId: user.id
            });
        }).then(function (result) {
            response.success({"privateData": result.privateData});
        },
        function (error) {
            response.error(JSON.stringify(error));
        });
});
/**
 * -- Deprecated --
 * @CloudFunction Activate SRS for User
 * Either called from iOS, from the
 * CloudFunction after subscribing stripe
 * users or from CloudFunction redeemPromoCode.
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
        premium,
        promises = [];

    if (activationKey !== "pacRe6e8rUthusuDEhEwUPEWrUpruhat")
        return response.error("Unauthorized request.");

    if (!user) {
        if (request.params.userId) {
            user = new Parse.User();
            user.id = request.params.userId;
            promises.push(user.fetch());

            var query = new Parse.Query(Parse.Role);
            query.equalTo('name', "Premium");
            promises.push(query.find().then(function (results) {
                premium = results[0];
                premium.getUsers().add(user);
                return premium.save();
            }));
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
                nextPaymentDate = new moment().add(intervalLength, interval),
                expiryDate = new moment().add(intervalLength, interval);

            privateData.set('isPremium', true);
            privateData.set('premiumStartDate', startDate.toDate());
            privateData.set('premiumNextPaymentDate', nextPaymentDate.toDate());
            privateData.set('premiumExpiryDate', expiryDate.toDate());
            privateData.set('premiumLastPurchase', intervalLength + " " + interval);
            privateData.set('premiumSignupSource', signupSource);
            privateData.set('premiumCancelled', false);

            privateData.set('spacedRepetitionActivated', true);
            privateData.set('spacedRepetitionStartDate', startDate._d);
            privateData.set('spacedRepetitionExpiryDate', expiryDate._d);
            privateData.set('spacedRepetitionLastPurchase', intervalLength + " " + interval);
            privateData.set('spacedRepetitionSignupSource', signupSource);
            privateData.set('spacedRepetitionSubscriptionCancelled', false);
            if (trialStartDate && trialStartDate) {
                privateData.set('spacedRepetitionTrialStartDate', trialStartDate.toDate());
                privateData.set('spacedRepetitionTrialExpiryDate', trialExpiryDate.toDate());
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
 * @CloudFunction Upgrade User to Premium
 * Called once payment is set up.
 * activationKey is required as iOS
 * payment validation is not possible.
 * Trusting source code robustness.
 * Therefore, this method CANNOT be called
 * from the Web: it is called by the
 * Cloudfunctions beginStripePaymentPlan
 * or redeemPromoCode.
 *
 * Also creates an SRS test for the user
 * if one doesn't already exist.
 *
 * @param {String} interval e.g. month, year
 * @param {Integer} intervalLength e.g. 6
 * @param {String} signupSource e.g. iOS, Web
 * @param {String} activationKey, expects pacRe6e8rUthusuDEhEwUPEWrUpruhat
 *
 * Additional if called from beginStripePaymentPlan
 * or redeemPromoCode:
 * @param {String} userId (request.user not set via Cloudfunctions)
 * @param {Object} stripeSubscription
 * @param {String} trialLength e.g. day, month
 * @param {Interger} trialLength
 *
 * @return {UserPrivate} privateData
 */
Parse.Cloud.define('upgradeUserToPremium', function (request, response) {
    Parse.Cloud.useMasterKey();
    // We need a unique token for iAP that can be verified
    var user = request.user,
        interval = request.params.interval,
        intervalLength = request.params.intervalLength,
        signupSource = request.params.signupSource,
        activationKey = request.params.activationKey,
        stripeSubscription = request.params.stripeSubscription,
    /*trialStartDate = request.params.trialStartDate,
     trialExpiryDate = request.params.trialExpiryDate,*/
        trialInterval = request.params.trialInterval,
        trialLength = request.params.trialLength,
        privateData,
        test,
        premium,
        promises = [];

    if (activationKey !== "pacRe6e8rUthusuDEhEwUPEWrUpruhat")
        return response.error("Unauthorized request.");

    if (!user) { // Called from another Cloudfunction
        if (request.params.userId) {
            user = new Parse.User();
            user.id = request.params.userId;
            promises.push(user.fetch());
        } else {
            return response.error("User is not set.");
        }
    }
    // Get Parse.Role "Premium"
    var query = new Parse.Query(Parse.Role);
    query.equalTo('name', "Premium");
    promises.push(query.find().then(function (results) {
        premium = results[0];
        premium.getUsers().add(user);
        return premium.save();
    }));

    Parse.Promise.when(promises)
        .then(function () {
            return user.get('privateData').fetch();
        })
        .then(function (result) {
            privateData = result;
            var startDate,
                nextPaymentDate,
                trialStartDate,
                trialExpiryDate;

            // Clear previous values
            privateData.set('premiumStartDate', null);
            privateData.set('premiumExpiryDate', null);
            privateData.set('premiumNextPaymentDate', null);

            if (trialInterval && trialLength) {
                // Promo code or First time payment plan has trial period
                if (privateData.get('isPremium') && privateData.get('premiumTrialExpiryDate')) {
                    // Extend premium trial expiry, no need to change trialStartDate.
                    trialExpiryDate = new moment(privateData.get('premiumTrialExpiryDate'))
                        .add(trialLength, trialInterval);
                    privateData.set('premiumTrialExpiryDate', trialExpiryDate.toDate());
                } else {
                    // New Trial
                    trialStartDate = new moment();
                    trialExpiryDate = new moment()
                        .add(trialLength, trialInterval);
                    privateData.set('premiumTrialStartDate', trialStartDate.toDate());
                    privateData.set('premiumTrialExpiryDate', trialExpiryDate.toDate());
                }
            }
            if (interval && intervalLength) {
                // Payment Premium Subscription
                if (!privateData.get('premiumMonthTrialRedeemed'))
                    privateData.set('premiumMonthTrialRedeemed', true);
                if (trialExpiryDate) {
                    startDate = new moment(trialExpiryDate);
                    nextPaymentDate = new moment(trialExpiryDate);
                }
                else {
                    startDate = new moment();
                    nextPaymentDate = new moment().add(intervalLength, interval);
                }
                privateData.set('premiumStartDate', startDate.toDate());
                privateData.set('premiumNextPaymentDate', nextPaymentDate.toDate());
                privateData.set('premiumLastPurchase', intervalLength + " " + interval);
            }

            privateData.set('isPremium', true);
            privateData.set('premiumSignupSource', signupSource);
            privateData.set('premiumCancelled', false);

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
                query.limit(50);
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
 * @CloudFunction cancelSubscription
 * No params needed
 * Just call from any user,
 * the function will cancel their
 * subscription
 */

Parse.Cloud.define('cancelSubscription', function (request, response) {
    Parse.Cloud.useMasterKey();
    // We need a unique token for iAP that can be verified
    var user = request.user;

    if (!user)
        return response.error("Unauthorized request.");

    var privateData = user.get('privateData');
    if (!privateData)
        return response.error("User does not have private data.");

    privateData.fetch()
        .then(function () {
            var subscription = privateData.get('stripeSubscription');
            if (subscription && subscription.id) {
                var subscriptionId = subscription.id;
                privateData.set('stripeSubscription', {});
                return Stripe.Customers.cancelSubscription(privateData.get('stripeToken'),
                    subscriptionId);
            } else {
                return;
            }
        }).then(function (httpResponse) {
            privateData.set('spacedRepetitionSubscriptionCancelled', true);
            privateData.set('premiumCancelled', true);
            privateData.set('premiumExpiryDate', privateData.get('premiumNextPayment'));
            privateData.set('premiumNextPayment', null);
            return privateData.save();
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
                        return Parse.Cloud.run('upgradeUserToPremium', {
                            trialInterval: 'month',
                            trialLength: 1,
                            signupSource: request.params.source,
                            activationKey: "pacRe6e8rUthusuDEhEwUPEWrUpruhat",
                            userId: user.id
                        });
                    } else {
                        console.error("Unkown action for this valid promo code.");
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
            var url = "https://mycqs.com/test/" + test.get('slug').trim();
            sitemapUrls += createSitemapNodeForUrl(url, priority, frequency, test.updatedAt);
        }
        response.success(sitemapUrls);
    }, function (error) {
        response.error(JSON.stringify(error));
    });
});
/**
 * @CloudFunction Generate Slug for Group
 * @param {String} groupName
 * @return {String} slug
 */
Parse.Cloud.define('generateSlugForGroup', function (request, response) {
    var groupName = request.params.groupName,
        initialSlug,
        slug;
    if (!groupName || !groupName.length)
        return response.error('Please send the groupName.');

    Parse.Cloud.useMasterKey(); // To find ALL (even secret) groups, checking for slugs.
    initialSlug = slugify("Group", groupName);
    var query = new Parse.Query("Group");
    query.startsWith('slug', initialSlug);
    query.count()
        .then(function (count) {
            if (!count)
                slug = initialSlug;
            else {
                query = new Parse.Query('Group');
                initialSlug += (count + 1);
                query.startsWith('slug', initialSlug);
                // Double check
                return query.count()
                    .then(function (count) {
                        if (!count)
                            slug = initialSlug;
                        else {
                            initialSlug += (count + 1); // Not fool proof, but should be fine.
                            slug = initialSlug;
                        }
                    });
            }
        }).then(function () {
            response.success(slug);
        }, function (error) {
            response.error(error);
        });

});
/**
 * @CloudFunction Add members to Group
 * Add unique members to a group,
 * add these members to the respective
 * Only use masterkey if membersCanInvite
 * @param {String} groupId
 * @param {Array} memberIds
 */
Parse.Cloud.define('addMembersToGroup', function (request, response) {
    var user = request.user,
        groupId = request.params.groupId,
        memberIds = request.params.memberIds,
        addSelfToGroup = false,
        membersToAdd,
        promises = [];

    if (user && memberIds.length === 1 && memberIds[0] === user.id) {
        addSelfToGroup = true;
        Parse.Cloud.useMasterKey();
    }

    var group = new Parse.Object('Group');
    group.id = groupId;
    group.fetch()
        .then(function () {
            var query = new Parse.Query(Parse.User);
            query.containedIn('objectId', memberIds);
            return query.find();
        }).then(function (results) {
            membersToAdd = results;
            if (!membersToAdd.length)
                return Parse.Promise.error("User(s) not found!");
            var members = group.relation('members');
            members.add(membersToAdd);
            var query = new Parse.Query(Parse.Role);
            query.equalTo('name', 'group-members-' + group.id);
            return query.find();
        }).then(function (results) {
            var role = results[0];
            if (!role)
                return Parse.Promise.error("Member roles not defined for group!");
            role.getUsers().add(membersToAdd);
            if (group.get('membersCanInvite')) {
                Parse.Cloud.useMasterKey();
            }
            promises.push(role.save());
            promises.push(group.save());
            // Add the group to each members respective
            // _User.groups relation
            // Need masterKey to alter _User.groups
            Parse.Cloud.useMasterKey();
            _.each(membersToAdd, function (member) {
                var memberGroups = member.relation('groups');
                memberGroups.add(group);
                if (group.id === "0aJRBiR9FU") {
                    if (!member.get('zzishClasses'))
                        member.set('zzishClasses', []);
                    member.get('zzishClasses').push("je3t4");
                }
                promises.push(member.save());
            });
            return Parse.Promise.when(promises);
        }).then(function () {
            var relation = group.relation('members'),
                query = relation.query();
            return query.count();
        }).then(function (count) {
            group.set('numberOfMembers', count);
            if (addSelfToGroup)
                return group.save();
            // Adding other people to group, send pushes/messages
            promises.push(group.save());
            _.each(membersToAdd, function (member) {
                var messageText = user.get('name') + " added you to a Group!";
                promises.push(
                    Parse.Cloud.run('sendPushToUser', {
                        message: messageText,
                        recipientUserId: member.id,
                        actionName: 'added-to-group',
                        actionParams: [
                            {name: "groupId", value: group.id},
                            {name: "groupName", value: group.get('name')},
                            {name: "groupSlug", value: group.get('slug')}
                        ]
                    }));
                var message = new Parse.Object("Message");
                message.set('from', user);
                message.set('to', member);
                message.set('message', messageText);
                message.set('group', group);
                message.set('isAutomated', false);
                message.set('type', "added-to-group");
                promises.push(message.save());
            });
            return Parse.Promise.when(promises);
        }).then(function () {
            return response.success();
        }, function (error) {
            return response.error(error);
        });
});
/**
 * @CloudFunction Remove members from Group
 * Remove members from a group,
 * remove these members from the respective
 * Parse.Role. Must return error if
 * request.user is not a group moderator
 * or admin.
 *
 * NOTE - Do not use for removing
 * moderators or admins, create/user
 * separate function to handle different roles
 * @param {String} groupId
 * @param {Array} memberIds
 */
Parse.Cloud.define('removeMembersFromGroup', function (request, response) {
    var user = request.user,
        groupId = request.params.groupId,
        memberIds = request.params.memberIds,
        membersToRemove,
        promises = [],
        errorMessage;

    var group = new Parse.Object('Group');
    group.id = groupId;
    group.fetch()
        .then(function () {
            var query = new Parse.Query(Parse.User);
            query.containedIn('objectId', memberIds);
            return query.find();
        }).then(function (results) {
            membersToRemove = results;
            var members = group.relation('members');
            members.remove(membersToRemove);
            var query = new Parse.Query(Parse.Role);
            query.equalTo('name', 'group-members-' + group.id);
            return query.find();
        }).then(function (results) {
            var role = results[0];
            if (!role)
                return errorMessage = "Member roles not defined for group!";
            role.getUsers().remove(membersToRemove);
            if (memberIds.length === 1 && memberIds[0] === user.id)
                Parse.Cloud.useMasterKey();
            promises.push(role.save());
            promises.push(group.save());
            /*
             * Need MasterKey to alter members
             * _User.groups relation. By this stage,
             * if the request.user did not have
             * permission, the code would have rejected.
             */
            Parse.Cloud.useMasterKey();
            // Remove the group to each members respective
            // _User.groups relation
            _.each(membersToRemove, function (member) {
                var memberGroups = member.relation('groups');
                memberGroups.remove(group);
                promises.push(member.save());
            });
            return Parse.Promise.when(promises);
        }).then(function () {
            var relation = group.relation('members'),
                query = relation.query();
            return query.count();
        }).then(function (count) {
            group.set('numberOfMembers', count);
            return group.save();
        }).then(function () {
            if (errorMessage)
                return response.error(errorMessage);
            else
                return response.success();
        }, function (error) {
            return response.error(JSON.stringify(error));
        });
});
/**
 * @CloudFunction Add tests to Group
 * Add unique tests to a group.
 * Make sure the tests are not private.
 * Only use masterkey if membersCanAddTests
 * @param {String} groupId
 * @param {Array} testIds
 */
Parse.Cloud.define('addTestsToGroup', function (request, response) {
    var user = request.user,
        groupId = request.params.groupId,
        testIds = request.params.testIds,
        testsToAdd = [],
        promises = [],
        errorMessage;

    var group = new Parse.Object('Group');
    group.id = groupId;
    group.fetch()
        .then(function () {
            if (group.get('membersCanAddTests'))
                Parse.Cloud.useMasterKey();
            var query = new Parse.Query("Test");
            query.containedIn('objectId', testIds);
            return query.find();
        }).then(function (results) {
            // Remove private tests
            for (var i = 0; i < results.length; i++) {
                if (results[i].get('privacy') === 1)
                    testsToAdd.push(results[i]);
            }
            var tests = group.relation('gatheredTests');
            tests.add(testsToAdd);
            return group.save();
        }).then(function () {
            var relation = group.relation('gatheredTests'),
                query = relation.query();
            return query.count();
        }).then(function (count) {
            group.set('numberOfGatheredTests', count);
            return group.save();
        }).then(function () {
            if (errorMessage)
                return response.error(errorMessage);
            else
                return response.success();
        }, function (error) {
            return response.error(JSON.stringify(error));
        });
});
/**
 * @CloudFunction Remove tests from Group
 * Remove tests from a group. Ambgious
 * to groupTests or gatheredTests.
 * However, a groupTest must be set
 * as isObjectDeleted to true from the
 * client app if deleted by an author.
 * Don't user masterkey.. the user should
 * have correct ACL role to achieve this.
 * @param {String} groupId
 * @param {Array} testIds
 */
Parse.Cloud.define('removeTestsFromGroup', function (request, response) {
    var user = request.user,
        groupId = request.params.groupId,
        testIds = request.params.testIds,
        testsToRemove,
        promises = [],
        errorMessage;

    var group = new Parse.Object('Group');
    group.id = groupId;
    group.fetch()
        .then(function () {
            var query = new Parse.Query("Test");
            query.containedIn('objectId', testIds);
            return query.find();
        }).then(function (results) {
            testsToRemove = results;
            /*
             * Ambigious removal from either relation.
             */
            var tests = group.relation('gatheredTests'),
                groupTests = group.relation('groupTests');
            tests.remove(testsToRemove);
            groupTests.remove(testsToRemove);
            return group.save();
        }).then(function () {
            var relation = group.relation('gatheredTests'),
                query = relation.query();
            return query.count();
        }).then(function (count) {
            group.set('numberOfGatheredTests', count);
            return group.save();
        }).then(function () {
            if (errorMessage)
                return response.error(errorMessage);
            else
                return response.success();
        }, function (error) {
            return response.error(JSON.stringify(error));
        });
});

/**
 * @CloudFunction Add Professional Questions
 *
 */
Parse.Cloud.define('addProfessionalQuestions', function (request, response) {
    Parse.Cloud.useMasterKey();
    var rawQuestions = request.params.questions,
        Question = Parse.Object.extend("Question"),
        questionsToSave = [],
        updateCount = 0,
        targetStudyFields = [],
        errors = [];

    var medicalStudyField = new Parse.Object("StudyField");
    medicalStudyField.id = "fll3AgsHnC";
    medicalStudyField.fetch().then(function () {
        targetStudyFields.push(medicalStudyField);
        var currentProfessionalQuestionsQuery = new Parse.Query("Question"),
            professionalQuestionIds = [];
        _.each(rawQuestions, function (rawQuestion) {
            professionalQuestionIds.push(rawQuestion["UID"]);
        });
        currentProfessionalQuestionsQuery.containedIn("professionalUID", professionalQuestionIds);
        currentProfessionalQuestionsQuery.limit(1000);
        return currentProfessionalQuestionsQuery.find();
    }).then(function (currentProfessionalQuestions) {
        var currentProfessionalQuestionUIDs = [];
        _.each(currentProfessionalQuestions, function (currentProfessionalQuestion) {
            currentProfessionalQuestionUIDs.push(currentProfessionalQuestion.get('professionalUID'));
        });
        _.each(rawQuestions, function (rawQuestion, index) {
            var question = new Question();
            if (_.contains(currentProfessionalQuestionUIDs, rawQuestion["UID"])) {
                question = _.find(currentProfessionalQuestions, function (currentProfessionalQuestion) {
                    return currentProfessionalQuestion.get('professionalUID') === rawQuestion["UID"];
                });
                updateCount++;
            } else {
                question.set('professionalUID', rawQuestion["UID"]);
            }
            if (question.get('level1'))
                return; // TODO remove this to allow updates
            question.set('isProfessional', true);
            question.set('bank', "medical");
            // Level 1
            if (rawQuestion["Level 1"])
                question.set("level1", rawQuestion["Level 1"].trim().replace("�", "'"));
            else
                question.set("level1", undefined);
            // Level 2
            if (rawQuestion["Level 2"] && rawQuestion["Level 2"].trim() !== "-")
                question.set("level2", rawQuestion["Level 2"].trim().replace("�", "'"));
            else
                question.set("level2", undefined);
            // Level 3
            if (rawQuestion["Level 3"] && rawQuestion["Level 3"].trim() !== "-")
                question.set("level3", rawQuestion["Level 3"].trim().replace("�", "'"));
            else
                question.set("level3", undefined);
            // Discipline
            if (rawQuestion["Discipline"] && rawQuestion["Discipline"].trim() !== "-")
                question.set('discipline', rawQuestion["Discipline"].trim().replace("�", "'"));
            else
                question.set("discipline", undefined);
            // Specialty
            if (rawQuestion["Speciality"] && rawQuestion["Speciality"].trim() !== "-")
                question.set('specialty', rawQuestion["Speciality"].trim().replace("�", "'"));
            else
                question.set("specialty", undefined);
            // Focus
            if (rawQuestion["Focus"] && rawQuestion["Focus"].trim() !== "-")
                question.set('focus', rawQuestion["Focus"].trim().replace("�", "'"));
            else
                question.set("focus", undefined);
            // Topic
            if (rawQuestion["Topic"] && rawQuestion["Topic"].trim() !== "-")
                question.set('topic', rawQuestion["Topic"].trim().replace("�", "'"));
            else
                question.set("topic", undefined);
            // SecondaryTopic
            if (rawQuestion["Secondary Topic"] && rawQuestion["Secondary Topic"].trim() !== "-")
                question.set('secondaryTopic', rawQuestion["Secondary Topic"].trim().replace("�", "'"));
            else
                question.set("secondaryTopic", undefined);
            // Core Tags
            if (rawQuestion["Core Tags"])
                question.set('coreTags', rawQuestion["Core Tags"].split(", "));
            else
                question.set('coreTags', []);
            // Extra Tags
            if (rawQuestion["Extra Tags"])
                question.set('extraTags', rawQuestion["Extra Tags"].split(", "));
            else
                question.set('extraTags', []);
            // Normal/Abnormal Medical
            if (rawQuestion["Normal/Abnormal"] && rawQuestion["Normal/Abnormal"] !== "n/a")
                question.set('medicalPerspective', rawQuestion["Normal/Abnormal"].trim().replace("�", "'"));
            else
                question.set('medicalPerspective', undefined);
            // Locality
            if (rawQuestion["Locality"])
                question.set('locality', rawQuestion["Locality"].trim().replace("�", "'"));
            else
                question.set('locality', undefined);
            // Module Tags
            if (rawQuestion["LDS"])
                question.set('moduleTags', ["LDS:" + rawQuestion["LDS"].trim().replace("�", "'")]);
            else
                question.set('moduleTags', []);

            question.set('targetStudyYears', ["Year 1", "Year 2"]);
            question.set('targetStudyFields', targetStudyFields);

            if (rawQuestion["Difficulty"] === 'Difficult')
                rawQuestion["Difficulty"] = 'hard';
            if (rawQuestion["Difficulty"])
                question.set('difficulty', rawQuestion["Difficulty"].trim().toLowerCase());
            /*if (rawQuestion.disciplineTags)
             question.set('disciplineTags', rawQuestion.disciplineTags.split(", "));*/

            if (!rawQuestion["Stem"])
                return errors.push("Question has no Stem, UID " + rawQuestion["UID"]);
            question.set('stem', rawQuestion["Stem"].trim().replace("�", "'"));

            if (!rawQuestion["Correct Answer"] || !rawQuestion["Incorrect 1"])
                return errors.push("Question has no Correct Answer or Incorrect 1, UID " + rawQuestion["UID"]);
            var options = [{"isCorrect": true, "phrase": rawQuestion["Correct Answer"].trim().replace("�", "'")},
                {"isCorrect": false, "phrase": rawQuestion["Incorrect 1"].trim().replace("�", "'")}];
            if (rawQuestion["Incorrect 2"])
                options.push({"isCorrect": false, "phrase": rawQuestion["Incorrect 2"].trim().replace("�", "'")});
            if (rawQuestion["Incorrect 3"])
                options.push({"isCorrect": false, "phrase": rawQuestion["Incorrect 3"].trim().replace("�", "'")});
            if (rawQuestion["Incorrect 4"])
                options.push({"isCorrect": false, "phrase": rawQuestion["Incorrect 4"].trim().replace("�", "'")});
            question.set('options', options);

            if (rawQuestion["Explanation"])
                question.set('feedback', rawQuestion["Explanation"].trim().replace("�", "'"));

            var ACL = new Parse.ACL();
            ACL.setRoleReadAccess('medical-professional', true);
            question.setACL(ACL);
            questionsToSave.push(question);
            //return question.save();
        });
        return Parse.Object.saveAll(questionsToSave);
    }).then(function (questionsSaved) {
        response.success("Saved " + questionsSaved.length + ". Updated " + updateCount + ". Errors: " + JSON.stringify(errors));
    }, function (error) {
        response.error(error);
    });
});
/**
 * @CloudFunction Get Professional Bank Topic List
 * Defaults to send all topic lists for the medical
 * bank. Currenty not filtering by levelType, better
 * to send all and sort locally.
 */
Parse.Cloud.define("getProfessionalBankTopicList", function (request, response) {
    Parse.Cloud.useMasterKey();
    var bank = request.params.bank,
        selectedDiscipline = request.params.selectedDiscipline,
        selectedSpecialty = request.params.selectedSpecialty,
        selectedFocus = request.params.selectedFocus,
        selectedTopic = request.params.selectedTopic,
        selectedSecondaryTopic = request.params.selectedSecondaryTopic,
        query = new Parse.Query("Question");
    if (!bank)
        bank = "medical";
    query.limit(1000);
    query.equalTo("isProfessional", true);
    query.equalTo("bank", bank);

    query.find().then(function (questions) {
        var levels = [],
            totalQuestions = questions.length;

        _.each(questions, function (question) {
            var level1,
                level2,
                level3;
            // Question has level1
            if (question.get('level1')) {
                // Create new level if one does not exist
                if (!(level1 = _.find(levels, function (level) {
                        return level.title === question.get('level1');
                    }))) {
                    level1 = {
                        title: question.get('level1'), levels: [], numberOfQuestions: 0, numberOfLevels: 0,
                        levelType: "1"
                    };
                    levels.push(level1);
                }
                // Increment question count for level
                level1.numberOfQuestions++;
            }

            // Question has level2, needs level1
            if (level1 && question.get('level2')) {
                // Create new level if one does not exist
                if (!(level2 = _.find(level1.levels, function (level) {
                        return level.title === question.get('level2');
                    }))) {
                    level2 = {
                        title: question.get('level2'), levels: [], numberOfQuestions: 0, numberOfLevels: 0,
                        levelType: "2"
                    };
                    level1.levels.push(level2);
                }
                // Increment question count for level2
                level2.numberOfQuestions++;
                // Increment level count for level1
                level1.numberOfLevels++;
            }

            // Question has level3, needs level2
            if (level2 && question.get('level3')) {
                // Create new level if one does not exist
                if (!(level3 = _.find(level2.levels, function (level) {
                        return level.title === question.get('level3');
                    }))) {
                    level3 = {title: question.get('level3'), numberOfQuestions: 0, levelType: "3"};
                    level2.levels.push(level3);
                }
                // Increment question count for level3
                level3.numberOfQuestions++;
                // Increment level count for level2
                level2.numberOfLevels++
            }


        });
        return response.success({
            levels: levels,
            totalQuestions: questions.length
        });
    });
});
/**
 * @CloudFunction Generate Questions from Bank
 * Professional question generator
 * @param {String} bank (defaults to 'medical')
 * @param {Array} levels e.g. [{type: focus, value: cardiology},...]
 * @param {String} difficulty (defaults to any)
 * @param {Integer} maxQuestions (defaults to 25)
 * @return {Attempt}
 */
Parse.Cloud.define('generateQuestionsFromBank', function (request, response) {
    Parse.Cloud.useMasterKey();
    var bank = request.params.bank,
        levels = request.params.levels,
        difficulty = request.params.difficulty,
        maxQuestions = request.params.maxQuestions,
        queries = [];

    if (!request.user)
        return response.error("You must be logged in as an admin.");

    if (!bank)
        bank = 'medical';

    _.each(levels, function (level) {
        var query = new Parse.Query("Question");
        query.equalTo('isProfessional', true);
        query.equalTo('bank', bank);
        // TODO do this after query to mix up difficulties
        if (difficulty && difficulty.toLowerCase() !== "any")
            query.equalTo('difficulty', difficulty.toLowerCase());
        query.equalTo("level" + level.type, level.value);
        queries.push(query);
    });

    // Max Questions sorted after query
    // Opinionated max 25.
    if (!maxQuestions)
        maxQuestions = 25;

    var mainQuery = Parse.Query.or.apply(Parse.Query, queries);
    mainQuery.limit(1000);
    mainQuery.find().then(function (results) {
        var questions = _.shuffle(results).splice(0, maxQuestions),
            attempt = new Parse.Object("Attempt");
        attempt.set('isGenerated', true);
        attempt.set('user', request.user);
        attempt.set('isProfessional', true);
        attempt.set('questionBank', bank);
        attempt.set('questions', questions);
        var ACL = new Parse.ACL(request.user);
        attempt.setACL(ACL);
        return attempt.save();
    }).then(function (attempt) {
        response.success(attempt);
    }, function (error) {
        response.error(error);
    });
});
Parse.Cloud.define('grantAccessToQuestionBank', function (request, response) {
    Parse.Cloud.useMasterKey();
    var passkey = request.params.passkey,
        user = request.user;

    if (!user || !user.get('privateData'))
        return response.error("You must be logged in!");

    /*if (!passkey)
     return response.error("You must provide a passkey!");*/

    var acceptedKeys = ["leeds-medics-2015"],
        keyIsValid = false;

    _.each(acceptedKeys, function (acceptedKey) {
        if (acceptedKey === passkey)
            keyIsValid = true;
    });
    /* // Not closing the beta for now
     if (!keyIsValid)
     return response.error("Invalid passkey!");*/

    var roleQuery = new Parse.Query(Parse.Role);
    roleQuery.equalTo('name', 'medical-professional');
    roleQuery.find().then(function (results) {
        var medicalRole = results[0];
        medicalRole.getUsers().add(user);
        var promises = [user.get('privateData').fetch(), medicalRole.save()];
        return Parse.Promise.when(promises);
    }).then(function () {
        user.get('privateData').set('hasAccessToBetaQuestionGenerator', true);
        return user.get('privateData').save();
    }).then(function () {
        response.success("Granted!");
    }, function (error) {
        response.error(error);
    });
});
/**
 * @CloudFunction Add/Remove Relation
 * Parse Data Browser is no good for manually
 * adding or removing relations. This is a
 * heterogenous function that can allow us
 * to perform relational changes via REST api.
 * // TODO add secret key.
 * @param {Boolean} removeRelation: default FALSE
 */
Parse.Cloud.define("addOrRemoveRelation", function (request, response) {
    Parse.Cloud.useMasterKey();
    var parentObjectClass = request.params.parentObjectClass,
        parentObjectId = request.params.parentObjectId,
        childObjectClass = request.params.childObjectClass,
        childObjectId = request.params.childObjectId,
        relationField = request.params.relationField,
        removeRelation = request.params.removeRelation,
        secret = request.params.secret,
        promises = [];

    if (secret !== "OamSSfv£OASxV34xce222sf");

    var parentObject = new Parse.Object(parentObjectClass);
    parentObject.id = parentObjectId;
    promises.push(parentObject.fetch());

    var childObject = new Parse.Object(childObjectClass);
    childObject.id = childObjectId;
    promises.push(childObject.fetch());

    Parse.Promise.when(promises).then(function () {
        var relation = parentObject.relation(relationField);
        if (removeRelation)
            relation.remove(childObject);
        else
            relation.add(childObject);
        return parentObject.save();
    }).then(function () {
        response.success("Relation added/removed!");
    }, function (error) {
        if (error)
            response.error(JSON.stringify(error));
        else
            response.error("Something went wrong!");
    });
});

Parse.Cloud.define('adminDashboardAnalytics', function (request, response) {
    var user = request.user,
        responseAnalytics = {},
        dayLimit = request.params.dayLimit;

    if (!user || (user.id !== 'jpIo9NFyml' && user.id !== 'K7El0VwkzF'))
        return response.error("You are not an authorised admin.");

    Parse.Cloud.useMasterKey();
    if (!dayLimit)
        dayLimit = 1;
    var query = new Parse.Query(Parse.User);
    query.exists("privateData");
    query.greaterThanOrEqualTo("createdAt", moment().subtract(dayLimit, 'day').toDate());
    query.count().then(function (count) {
        responseAnalytics.newSignups = count;

        var query = new Parse.Query("Test");
        query.notEqualTo("isSpacedRepetition", true);
        query.greaterThanOrEqualTo("createdAt", moment().subtract(dayLimit, 'day').toDate());
        return query.count();
    }).then(function (count) {
        responseAnalytics.testsCreated = count;

        var query = new Parse.Query("Attempt");
        query.notEqualTo("isSRSAttempt", true);
        query.greaterThanOrEqualTo("createdAt", moment().subtract(dayLimit, 'day').toDate());
        return query.count();
    }).then(function (count) {
        responseAnalytics.testsTaken = count;

        var query = new Parse.Query("UserPrivate");
        query.greaterThanOrEqualTo("premiumStartDate", moment().subtract(dayLimit, 'day').toDate());
        return query.count();
    }).then(function (count) {
        responseAnalytics.premiumSubscriptions = count;
        response.success(responseAnalytics);
    }, function (error) {
        response.error(error);
    });
});

/**
 * @CloudFunction Initialise Website for User
 *
 * This minimises time spent for the website's initial load
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
        latestAttempts,
        messages,
        followers,
        following,
        groups,
        attempts,
        activities,
        promises = [];

    promises.push(config = Parse.Config.get());
    promises.push(categories = new Parse.Query("Category").include("parent").find());
    if (user) {
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
    }
    Parse.Promise.when(promises).then(function () {
        var result = {
            config: config,
            categories: categories["_result"][0]
        };
        if (tests)
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
        }
        return response.success(result);
    }, function (error) {
        return response.error(error);
    });
});