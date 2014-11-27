/**
 * ---------
 * sendEmail
 * ---------
 * @param {String} templateName
 * @param {_User} user
 * @param {String} email
 * @param {Array} data [{name, content}] (optional)
 */

function sendEmail(templateName, user, email, data) {
    var promise = new Parse.Promise();
    /*
     * Send welcome email via Mandrill
     */
    if (!email || !email.length) {
        promise.reject("No email given");
        return promise;
    }

    var firstName = user.get("name").split(" ")[0],
        globalData = data;

    if (!data)
        globalData = [];

    globalData.push({"name": "FNAME", "content": firstName});

    console.log("Email about to be sent with " + JSON.stringify(globalData));

    var subject;
    switch (templateName) {
        case 'welcome-email':
            subject = "Hey " + firstName + ", welcome to MyCQs!";
            break;
        case 'forgotten-password':
            subject = "Reset your MyCQs password";
            break;
    }

    promise = Mandrill.sendTemplate({
        template_name: templateName,
        template_content: [],
        message: {
            subject: subject,
            from_email: "no-reply@mycqs.com",
            from_name: "MyCQs",
            global_merge_vars: globalData,
            to: [
                {
                    email: email,
                    name: user.get("name")
                }
            ]
        },
        async: true
    }, {
        success: function (httpResponse) {
            console.log("Sent email: " + JSON.stringify(httpResponse));
        },
        error: function (httpResponse) {
            console.error("Error sending email: " + JSON.stringify(httpResponse));
        }
    });

    return promise;
}




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

/*
 * Useful functions
 */
/**
 * ------------------
 * Security
 * ------------------
 * Our security object for any functions relating to:
 * - ACLs
 * - Roles
 */
var Security = {
    /**
     * ------------------
     * createACLs
     * ------------------
     * Object level ACLs for any Class.
     * Shorthands:
     * - createACLs() - hide from everyone including author
     * - createACLs(user) - author has read/write, public has read access only
     * - createACLs(user, false) - author has read/write, public cannot access
     * - createACLs(user, false, false, true) - author can read, but not write. No public access.
     * @namespace Security
     * @param {_User} user
     * @param {bool} publicReadAccess {def true}
     * @param {bool} publicWriteAccess {def false}
     * @param {bool} disableUserWriteAccess
     * @returns {ACL} ACLs
     */
    createACLs: function (user, publicReadAccess, publicWriteAccess, disableUserWriteAccess) {
        var ACLs;
        if (user && !disableUserWriteAccess)
            ACLs = new Parse.ACL(user);
        else
            ACLs = new Parse.ACL();

        if (disableUserWriteAccess)
            ACLs.setReadAccess(user.id, true);

        if (!user)
            publicReadAccess = false;
        else if (publicReadAccess !== false && publicReadAccess !== true)
            publicReadAccess = true;

        if (publicWriteAccess !== false && publicWriteAccess !== true)
            publicWriteAccess = false;

        ACLs.setPublicReadAccess(publicReadAccess);
        ACLs.setPublicWriteAccess(publicWriteAccess);

        return ACLs;
    },

    publicReadOnly: function () {
        var ACLs = new Parse.ACL();
        ACLs.setPublicReadAccess(true);
        return ACLs;
    }
};

/**
 * ---------------------
 * generateRandomString
 * ---------------------
 * Generates a random string of given
 * length with characters from the
 * included types. E.g. (12, 'aA#') // u23l123aOil9
 * @param {int} length
 * @param {String} type
 * @returns {String} result
 */
function generateRandomString(length, type) {
    var mask = '';
    if (type.indexOf('a') > -1) mask += 'abcdefghijklmnopqrstuvwxyz';
    if (type.indexOf('A') > -1) mask += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (type.indexOf('#') > -1) mask += '0123456789';
    if (type.indexOf('!') > -1) mask += '~`!@#$%^&*()_+-={}[]:";\'<>?,./|\\';
    var result = '';
    for (var i = length; i > 0; --i) result += mask[Math.round(Math.random() * (mask.length - 1))];
    return result;
}

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
 * ---------------------
 * capitaliseFirstLetter
 * ---------------------
 * @param string
 * @returns {string}
 */
function capitaliseFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * ----------------------
 * getUserProfileImageUrl
 * ----------------------
 * Returns uploaded profilePicture,
 * or facebook profile picture url,
 * or default silhouette.
 *
 * @param {_User} user
 * @returns {String} url
 */
function getUserProfileImageUrl(user) {
    if (user.get('profilePicture') && user.get('profilePicture').url())
        return user.get('profilePicture').url();
    else if (user.get('fbid') && user.get('fbid').length)
        return "http://res.cloudinary.com/mycqs/image/facebook/c_thumb,e_improve,g_faces:center,w_150/" + user.get('fbid');
    else
        return "http://assets.mycqs.com/img/silhouette.png";
}

/**
 * --------
 * maxTwoDP
 * --------
 * Converts any int or float into
 * a float with maximum of two
 * decimal places:
 * 2.57755 // 2.58
 * 56.1    // 56.1
 * 80      // 80
 *
 * @param {Number} number
 * @return {float} float
 */
var maxTwoDP = function (number) {
    var float = +parseFloat(number).toFixed(2);
    return float;
}
/**
 * -------------------------
 * getSwiftDocumentForObject
 * -------------------------
 * Creates swiftype documents
 * for object indexing
 *
 * @param {String} className
 * @param {Object} object
 * @return {Object} document
 */
var getSwiftDocumentForObject = function (className, object) {
    var document = {
        external_id: object.id
    };

    switch (className) {
        case "_User":
            if (!object.get('name') || !object.get('slug'))
                return;

            document.fields = [
                {
                    name: 'name',
                    value: object.get('name'),
                    type: 'string'
                },
                {
                    name: 'slug',
                    value: object.get('slug'),
                    type: 'string'
                },
                {
                    name: 'profileImageUrl',
                    value: getUserProfileImageUrl(object),
                    type: 'enum'
                },
                {
                    name: 'numberOfFollowers',
                    value: object.get('numberOfFollowers'),
                    type: 'integer'
                },
                {
                    name: 'numberFollowing',
                    value: object.get('numberFollowing'),
                    type: 'integer'
                },
                {
                    name: 'numberOfTests',
                    value: object.get('numberOfTests'),
                    type: 'integer'
                },
                {
                    name: 'createdAt',
                    value: object.createdAt,
                    type: 'date'
                },
                {
                    name: 'updatedAt',
                    value: object.updatedAt,
                    type: 'date'
                }
            ];
            if (object.get('institution') && object.get('institution').get('name')) {
                document.fields.push({name: 'institutionId', value: object.get('institution').id, type: 'enum'});
                document.fields.push({
                    name: 'institutionName',
                    value: object.get('institution').get('name'),
                    type: 'string'
                });
            }
            if (object.get('course') && object.get('course').get('name') && object.get('yearNumber')) {
                document.fields.push({name: 'courseId', value: object.get('course').id, type: 'enum'});
                document.fields.push({name: 'courseName', value: object.get('course').get('name'), type: 'string'});
                document.fields.push({name: 'yearNumber', value: object.get('yearNumber'), type: 'integer'});
            }
            break;
        case "Test":
            if (!object.get('title') || !object.get('slug') || !object.get('category') || !object.get('author'))
                return;

            var description = object.get('description'),
                numberOfQuestions = 0;

            if (!description)
                description = "";
            if (object.get('questions'))
                numberOfQuestions = object.get('questions').length;

            document.fields = [
                {
                    name: 'title',
                    value: object.get('title'),
                    type: 'string'
                },
                {
                    name: 'slug',
                    value: object.get('slug'),
                    type: 'string'
                },
                {
                    name: 'authorId',
                    value: object.get('author').id,
                    type: 'enum'
                },
                {
                    name: 'authorName',
                    value: object.get('author').get('name'),
                    type: 'string'
                },
                {
                    name: 'categoryId',
                    value: object.get('category').id,
                    type: 'enum'
                },
                {
                    name: 'categoryName',
                    value: object.get('category').get('name'),
                    type: 'string'
                },
                {
                    name: 'description',
                    value: description,
                    type: 'string'
                },
                {
                    name: 'numberOfQuestions',
                    value: numberOfQuestions,
                    type: 'integer'
                },
                {
                    name: 'createdAt',
                    value: object.createdAt,
                    type: 'date'
                },
                {
                    name: 'updatedAt',
                    value: object.updatedAt,
                    type: 'date'
                },
                {
                    name: 'authorImageUrl',
                    value: getUserProfileImageUrl(object.get('author')),
                    type: 'string'
                }
            ];
            break;
    }
    return document;
}
/**
 * createSitemapNodeForUrl
 * @param {String} url
 * @param {Integer} priority
 * @param {String} frequency
 * @param {Date} lastmod
 */
var createSitemapNodeForUrl = function (url, priority, frequency, lastmod) {
    if(!priority)
        priority = 0.5;
    if(!frequency)
        frequency = "weekly";
    if(!lastmod)
        lastmod = new Date();
    return "<url> \
    <loc>"+url+"</loc> \
    <priority>"+priority+"</priority> \
    <changefreq>"+frequency+"</changefreq> \
    <lastmod>"+moment(lastmod).format("YYYY-MM-DD")+"</lastmod>\
    </url>";
}

var getNextDueTimeForSRSTest = function (intensityLevelConfig, timeZone) {
    console.log("Get SRS next due "+JSON.stringify(intensityLevelConfig)+" timeZone "+timeZone);
    var currentTime = new Date(),
        localTime = new moment(currentTime).tz(timeZone),
        nextDue;

    for (var i = 0; i < intensityLevelConfig.times.length; i++) {
        var dueTime = new moment().tz(timeZone)
            .set("hours", intensityLevelConfig.times[i].slice(0, 2))
            .set("minutes", 0)
            .set("seconds", 0);

        if (dueTime.isAfter(localTime)) {
            nextDue = dueTime;
            break;
        } else {
            continue;
        }
    }
    if (!nextDue) {
        // Due first thing tomorrow.
        nextDue = new moment().tz(timeZone)
            .set("hours", intensityLevelConfig.times[0].slice(0, 2))
            .set("minutes", 0)
            .set("seconds", 0)
            .add(1, 'days');
    }
    return nextDue;
}