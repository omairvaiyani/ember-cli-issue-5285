// Concat source to main.js with 'cat source/*.js > cloud/main.js'

var _ = require("underscore"),
    moment = require('cloud/moment-timezone-with-data.js'),
    mandrillKey = 'zAg8HDZtlJSoDu-ozHA3HQ',
    Mandrill = require('mandrill'),
    Stripe = require('stripe');

Mandrill.initialize(mandrillKey);

//Stripe.initialize('sk_test_AfBhaEg8Yojoc1hylUI0pdtc'); // testing key
 Stripe.initialize('sk_live_AbPy747DUMLo8qr53u5REcaX'); // live key

var MyCQs = {
    baseUrl: 'http://mycqs.com/'
};
var FB = {
    API: {
        url: 'https://graph.facebook.com/v2.1/me/'
    },
    GraphObject: {
        appId: "394753023893264",
        namespace: "mycqs_app",
        testUrl: MyCQs.baseUrl + "test/"
    }
};
var PromiseHelper = {
    ABORT_CHAIN: 100
};/**
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
}/**
 * @BackgroundJob Test Quality Score
 *
 * For each test, use our algorithm
 * for determining good quality tests
 * - Max score 100
 * -- Low quality cut off, 20
 * - Judge by number of questions (MAX 25)
 * -- 10-25 optimal
 * - % of explanations (MAX 25)
 * -- 100% is best
 * - Number of attempts (MAX 15)
 * -- Variable
 * - Percentage of unique attempts (MAX 20)
 * -- Lower the better (more repeats), below 50% for now
 * - Unique average scores (MAX 15)
 * -- Optimal is 55-85%
 */
Parse.Cloud.job('testQualityScore', function (request, status) {
    Parse.Cloud.useMasterKey();
    var query = new Parse.Query('Test'),
        promises = [];
    query.include('questions');
    query.each(function (test) {
        var previousScore = test.get('quality'),
            score = 0;

        var numberOfQuestions = test.get('questions').length;
        // Number of questions 0-4 = 0
        // Number of questions 5-9 = +5
        if (numberOfQuestions > 4 && numberOfQuestions < 10)
            score += 5;
        // Number of questions 10-25 = +25
        else if (numberOfQuestions > 9 && numberOfQuestions < 26)
            score += 25;
        // Number of questions 25+ = +15
        else if (numberOfQuestions > 25)
            score += 15;

        var numberOfExplanations = 0,
            percentageOfExplanations = 0;

        for (var i = 0; i < test.get('questions').length; i++) {
            var question = test.get('questions')[i];
            if (!question)
                continue;
            if (question.get('explanation') && question.get('explanation').length)
                numberOfExplanations++;
        }
        // Percentage of explanations 0% or 0 questions = 0
        if (numberOfExplanations && test.get('questions').length) {
            percentageOfExplanations = Math.floor((numberOfExplanations / test.get('questions').length) * 100);
            // Percentage of explanations > 0 and < 25 questions = +5
            if (percentageOfExplanations > 0 && percentageOfExplanations < 25)
                score += 5;
            // Percentage of explanations > 24 and < 50 questions = +10
            else if (percentageOfExplanations > 24 && percentageOfExplanations < 50)
                score += 10;
            // Percentage of explanations > 49 and < 75 = +15
            else if (percentageOfExplanations > 49 && percentageOfExplanations < 75)
                score += 15;
            // Percentage of explanations > 74 and < 100 questions = +20
            else if (percentageOfExplanations > 74 && percentageOfExplanations < 100)
                score += 20;
            // Percentage of explanations 100% = +25
            else if (percentageOfExplanations === 100)
                score += 25;
        }

        var numberOfAttempts = test.get('numberOfAttempts');
        // Number of attempts 0 = 0
        // Number of attempts > 0 and < 5 = +5
        if (numberOfAttempts > 0 && numberOfAttempts < 5)
            score += 5;
        // Number of attempts > 5 and < 15 = +10
        else if (numberOfAttempts > 4 && numberOfAttempts < 15)
            score += 10;
        // Number of attempts > 14 = +15
        else if (numberOfAttempts > 14)
            score += 15;

        var uniqueNumberOfAttempts = test.get('uniqueNumberOfAttempts'),
            percentageOfUniqueAttempts;


        if (uniqueNumberOfAttempts && numberOfAttempts) {
            percentageOfUniqueAttempts = Math.floor((uniqueNumberOfAttempts / numberOfAttempts) * 100);
            // Percentage of unique attempts 0 = +25
            if (percentageOfUniqueAttempts < 10)
                score += 25;
            // Percentage of unique attempts > 9 and < 25 = 20
            else if (percentageOfUniqueAttempts > 9 && percentageOfUniqueAttempts < 25)
                score += 20;
            // Percentage of unique attempts > 24 and < 50 = 15
            else if (percentageOfUniqueAttempts > 24 && percentageOfUniqueAttempts < 50)
                score += 15;
            // Percentage of unique attempts > 49 and < 75 = 10
            else if (percentageOfUniqueAttempts > 49 && percentageOfUniqueAttempts < 75)
                score += 10;
            // Percentage of unique attempts > 74 = 0
        }

        var uniqueAverageScore = test.get('uniqueAverageScore');

        // Unique average score 0 = 0
        // Unique average score > 0 and < 40 = 5
        if (uniqueAverageScore > 0 && uniqueAverageScore < 40)
            score += 5;
        // Unique average score > 39 and < 55 = 10
        else if (uniqueAverageScore > 39 && uniqueAverageScore < 55)
            score += 10;
        // Unique average score > 54 and < 85 = 20
        else if (uniqueAverageScore > 54 && uniqueAverageScore < 85)
            score += 15;
        // Unique average score > 84 = 15
        else if (uniqueAverageScore > 84)
            score += 10;

        if (score !== previousScore) {
            test.set('quality', score);
            /*
             * Though adding promises to a promise array
             * would speed up the process, instead of
             * synchronously waiting for each test to save
             * before progress.. our request limit is easily
             * reached. Therefore, we're using this bottlenecking
             * method.
             * Empty p
             */
            promises.push({});
            return test.save();
            // promises.push(test.save());
        }
    }, function (error) {
        console.error("Error looping through test in Test Quality Score job " + JSON.stringify(error));
        // }).then(function () {
        //   return Parse.Promise.when(promises);
    }).then(function () {
        status.success("Successfully updated " + promises.length + " test scores!");
    }, function (error) {
        status.error("Only updated " + promises.length + " tests before error. " + JSON.stringify(error));
    })
});

/**
 * @BackgroundJob - Index Objects for Class
 * Search indexing
 * Add objects to Swiftype
 * @param className
 */
Parse.Cloud.job("indexObjectsForClass", function (request, status) {
    Parse.Cloud.useMasterKey();

    var className = request.params.className,
        query = new Parse.Query(className),
        swiftApiUrl;

    switch (className) {
        case "_User":
            query = new Parse.Query(Parse.User);
            query.include('course');
            query.include('institution');
            swiftApiUrl = "http://api.swiftype.com/api/v1/engines/mycqs/document_types/users/documents/create_or_update.json";
            break;
        case "Test":
            query.include('author');
            query.include('category');
            swiftApiUrl = "http://api.swiftype.com/api/v1/engines/mycqs/document_types/tests/documents/create_or_update.json";
            break;
    }

    var document;
    query.each(function (object) {
        document = getSwiftDocumentForObject(className, object);
        if (!document)
            return;

        return Parse.Cloud.httpRequest({
            method: 'POST',
            url: swiftApiUrl,
            headers: {
                'Content-Type': 'application/json'
            },
            body: {
                auth_token: "xBAVD6EFQzt23WJFhp1v",
                document: document
            }
        }).then(function (success) {
                console.log("Successful call to swiftype, " + JSON.stringify(success.data));
            },
            function (error) {
                console.log("Document error: " + JSON.stringify(document));
                console.log("Failure to call to swiftype, " + error.text);
            });

    }).then(
        function () {
            status.success();
        }, function () {
            status.error();
        });

});

/**
 * @BackgroundJob - Update the Count Class
 * Saves us counting through hundreds of thousands of
 * rows per client visit.
 */
Parse.Cloud.job("updateCountClass", function (request, status) {
    Parse.Cloud.useMasterKey();
    /*
     * _User
     */
    var query = new Parse.Query("Count"),
        users,
        tests,
        questions,
        attempts,
        promises = [],
        ACL = new Parse.ACL();

    ACL.setPublicReadAccess(true);

    query.find()
        .then(function (results) {
            for (var i = 0; i < results.length; i++) {
                switch (results[i].get('type')) {
                    case "users":
                        users = results[i];
                        break;
                    case "tests":
                        tests = results[i];
                        break;
                    case "questions":
                        questions = results[i];
                        break;
                    case "attempts":
                        attempts = results[i];
                        break;
                }
            }
            query = new Parse.Query(Parse.User);
            return query.count();
        })
        .then(function (count) {
            users.set('total', count);
            users.setACL(ACL);
            promises.push(users.save());

            query = new Parse.Query("Test");
            return query.count();
        })
        .then(function (count) {
            tests.set('total', count);
            tests.setACL(ACL);
            promises.push(tests.save());

            query = new Parse.Query("Question");
            return query.count();
        })
        .then(function (count) {
            questions.set('total', count);
            questions.setACL(ACL);
            promises.push(questions.save());

            query = new Parse.Query("Attempt");
            return query.count();
        })
        .then(function (count) {
            attempts.set('total', count);
            attempts.setACL(ACL);
            promises.push(attempts.save());

            return Parse.Promise.when(promises);
        })
        .then(function () {
            status.success();
        });
});

/**
 * @BackgroundJob - Calculate total tests in Each Category
 * Loops through child categories
 * Updates total test count on them
 * and their parent categories.
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
        testQuery.notEqualTo('isObjectDeleted', true);
        testQuery.equalTo('privacy', 1);
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

        for (var i = 0; i < parentCategories.length; i++) {
            saveCategoriesPromises.push(parentCategories[i].save());
        }
        return Parse.Promise.when(saveCategoriesPromises);
    }).then(function () {
        status.success();
    })
});

/**
 * @BackgroundJob SpacedRepetitionRunLoop
 *
 * Spaced Repetition System (SRS)
 *
 * This job achieves a number of SRS tasks for
 * the subscribed users:
 * - Checks if they have any Unique Responses (URs)
 * - If so, checks if they have a Generated SR Test (GSR Test)
 * - If no, create one; if yes, clears its questions
 * - Check when the next due time is for their set intensity
 * - Update nextDue date if needed
 *
 * - If current time is equal to due time, carry on
 * - Per UR, check if the time since question was answered equals time to repeat*
 * - If true, add question to the GSR Test
 * - Once GSR Test is ready, shuffle and strip down to 15 questions
 * - Schedule push.
 *
 * repeat*: SRS repeat timings update as the user consecutively answers
 * the question correctly: moving from Box 1 to Box 2: as per Intensity level.
 *
 * SRS Intensity and Box are configuration dependent.
 */
Parse.Cloud.job('spacedRepetitionRunLoop', function (request, status) {
    Parse.Cloud.useMasterKey();
    var query,
        srIntensityLevels,
        promises = [];

    Parse.Config.get()
        .then(function (config) {
            srIntensityLevels = config.get("spacedRepetitionIntensityLevels");
            query = new Parse.Query('UserPrivate');
            query.equalTo('spacedRepetitionActivated', true);
            return query.find();
        })
        .then(function (results) {
            var usernames = [];
            for (var i = 0; i < results.length; i++) {
                usernames.push(results[i].get('username'));
            }
            query = new Parse.Query(Parse.User);
            query.containedIn('username', usernames);
            if (request.params.userId)
                query.equalTo('objectId', request.params.userId);
            query.include('privateData');
            return query.each(
                function (user) {
                    var privateData = user.get('privateData'),
                        srIntensityNumber = user.get('spacedRepetitionIntensity'),
                        srIntensityLevel = srIntensityLevels[srIntensityNumber - 1],
                        installation,
                        timeZone = user.get('timeZone'),
                        gsrTest,
                        isGSRTestNew = false,
                        gsrAttempt = new Parse.Object('Attempt');

                    /*
                     * TimeZone is set:
                     * - Parse.Installation for app users
                     * - _User for web users
                     */
                    query = new Parse.Query(Parse.Installation);
                    query.equalTo('user', user);
                    return query.find()
                        .then(function (installations) {
                            if (installations[0]) {
                                installation = installations[0];
                                timeZone = installation.get('timeZone');
                                if(!timeZone || timeZone == "null" || timeZone === null)
                                    timeZone = "Europe/London";
                            }
                            var currentTime = new Date();
                            console.log("Current time " + currentTime + " timeZone " + timeZone);
                            var localTime = new moment(currentTime).tz(timeZone),
                                localTimeHours = localTime.format('HH'),
                                nextDue = getNextDueTimeForSRSTest(srIntensityLevel, timeZone);

                            if (user.get('spacedRepetitionNextDue') !== nextDue) {
                                user.set('spacedRepetitionNextDue', nextDue._d);
                                promises.push(user.save());
                            }
                            /*
                             * See if the user's intensity level allows for a
                             * test to be sent now: based on their timezone.
                             */
                            if (srIntensityLevel.times.indexOf(localTimeHours + "00") === -1) {
                                console.log(user.get("name") + " is not expecting a push/email yet.");
                                return PromiseHelper.ABORT_CHAIN;
                            } else {
                                console.log("Preparing a SRS test for " + user.get("name"));
                            }

                            query = new Parse.Query('Test');
                            query.equalTo('author', user);
                            query.equalTo('isSpacedRepetition', true);
                            return query.find()
                        })
                        .then(function (results) {
                            if (results === PromiseHelper.ABORT_CHAIN)
                                return PromiseHelper.ABORT_CHAIN;

                            if (results[0]) {
                                gsrTest = results[0];
                                //gsrTest.set('questions', []); removed this, as questions will be a superset
                                // of all SRS questions
                                return gsrTest;
                            } else {
                                isGSRTestNew = true;
                                var Test = Parse.Object.extend('Test');
                                gsrTest = new Test();
                                gsrTest.set('isGenerated', true);
                                gsrTest.set('isSpacedRepetition', true);
                                gsrTest.set('author', user);
                                gsrTest.set('title', "Spaced Repetition Test");
                                gsrTest.set('privacy', 0);
                                gsrTest.set('questions', []);
                                var Category = Parse.Object.extend('Category'),
                                    srCategory = new Category();
                                srCategory.id = "jWx56PKQzU"; // Spaced Repetition is a Category
                                gsrTest.set('category', srCategory);
                                var ACL = new Parse.ACL();
                                ACL.setReadAccess(user.id, true);
                                gsrTest.setACL(ACL);
                                return gsrTest.save();
                            }
                        }, function (error) {
                            console.error("Error finding if SRS user has a GSR Test");
                        })
                        .then(function (gsrTest) {
                            if (gsrTest === PromiseHelper.ABORT_CHAIN)
                                return PromiseHelper.ABORT_CHAIN;

                            query = new Parse.Query('UniqueResponse');
                            query.equalTo('user', user);
                            console.log(user.get('name') + " is srs new> " + isGSRTestNew);
                            if (isGSRTestNew) {
                                /* We'll need to find all their recent
                                 * URs to prefill the GSRTest.questions
                                 */
                                query.descending('updatedAt');
                                query.limit(250);
                            } else {
                                /*
                                 * We already have a superset of GSRTest.questions
                                 * This query is therefore to check the current
                                 * box number for these questions.
                                 */
                                query.containedIn('question', gsrTest.get('questions'));
                            }
                            return query.find();
                        }, function (error) {
                            console.error("Error saving new GSR Test for user " + user.id + " error: " + JSON.stringify(error));
                        })
                        .then(function (uniqueResponses) {
                            if (uniqueResponses === PromiseHelper.ABORT_CHAIN)
                                return PromiseHelper.ABORT_CHAIN;

                            if (!uniqueResponses || !uniqueResponses.length) {
                                console.error("No URs or GSRTest.questions* for " + user.get('name'));
                                return PromiseHelper.ABORT_CHAIN;
                            }

                            /*
                             * We are pushing an Attempt object
                             * to the client. The attempt will
                             * have the due questions.
                             */
                            gsrAttempt.set('test', gsrTest);
                            gsrAttempt.set('questions', []);
                            gsrAttempt.set('user', user);
                            gsrAttempt.set('responses', []); // Only for convenience, not used here.
                            gsrAttempt.set('isSRSAttempt', true);

                            console.log(user.get("name") + " UR found " + uniqueResponses.length);

                            for (var i = 0; i < uniqueResponses.length; i++) {
                                var uniqueResponse = uniqueResponses[i];
                                // Prefill a new GSRTest.questions with all URs
                                if (isGSRTestNew)
                                    gsrTest.get('questions').push(uniqueResponse.get('question'));

                                var timeSinceTaken = Math.abs(new Date() - uniqueResponse.updatedAt) / 36e5,
                                    srBox = uniqueResponse.get('spacedRepetitionBox'),
                                    timeToRepeat = srIntensityLevel.boxes[srBox - 1],
                                    isTimeToRepeat = timeSinceTaken >= timeToRepeat;

                                if (isTimeToRepeat) {
                                    gsrAttempt.get('questions').push(uniqueResponse.get('question'));
                                } else {
                                    // TODO REMOVE THIS WHEN LIVE
                                    gsrAttempt.get('questions').push(uniqueResponse.get('question'));
                                }
                            }
                            console.log(user.get('name') + " Attempt question count " + gsrAttempt.get('questions').length);
                            var maxQuestions = user.get('spacedRepetitionMaxQuestions') ?
                                user.get('spacedRepetitionMaxQuestions') : 15;

                            if (gsrAttempt.get('questions').length > maxQuestions) {
                                var limitedQuestions = _.shuffle(gsrAttempt.get('questions')).splice(0, maxQuestions);
                                console.log(user.get('name') + " limited questions length " + limitedQuestions.length);
                                gsrAttempt.set('questions', limitedQuestions);
                            }
                            /*
                             * If GSRTest is new, we will have added
                             * new questions (URs) to it in the forLoop
                             * above, therefore we need to save it.
                             * However, it is not essential for the next
                             * chain, hence it is done asynchronously.
                             */
                            if (isGSRTestNew)
                                promises.push(gsrTest.save());


                            console.log(user.get('name') + " saving SRS attempt");
                            return gsrAttempt.save();
                        },
                        function (error) {
                            console.error("Error getting uniqueResponse for user " + user.id + " error: "
                            + JSON.stringify(error));
                        })
                        .then(function (gsrAttempt) {
                            if (gsrAttempt === PromiseHelper.ABORT_CHAIN)
                                return PromiseHelper.ABORT_CHAIN;

                            user.set('latestSRSAttempt', gsrAttempt);
                            promises.push(user.save());

                            if (!gsrAttempt.get('questions').length) { // Empty attempt
                                console.log("There are no questions for this SRS attempt for " + user.get("name"));
                                return;
                            }
                            // Create a Message object
                            var message = new Parse.Object("Message"),
                                messageText = "";
                            if (gsrAttempt.get('questions').length === 1)
                                messageText += "You just have 1 question to do for now!";
                            else
                                messageText += "Here are " + gsrAttempt.get('questions').length + " questions for you to do!";
                            message.set('to', user);
                            message.set('type', 'SRS');
                            message.set('message', messageText);
                            message.set('isAutomated', true);
                            message.set('attempt', gsrAttempt);
                            message.setACL(new Parse.ACL(user));
                            promises.push(message.save());
                            if (user.get('spacedRepetitionNotificationByPush')) {
                                console.log("Sending GSR Attempt by push to " + user.get('name'));
                                promises.push(Parse.Cloud.run('sendPushToUser',
                                    {
                                        message: messageText,
                                        recipientUserId: user.id,
                                        actionName: 'take-attempt',
                                        sound: 'srs',
                                        actionParams: [{name: "attempt", "content": gsrAttempt.id},
                                            {"name": "type", "content": "spaced-repetition"}]
                                    }));
                            }
                            // TODO Remove this once we're happy to send out emails again!
                            return;

                            if (user.get('spacedRepetitionNotificationByEmail')) {
                                var query = new Parse.Query('UserPrivate');
                                query.equalTo('username', user.getUsername());
                                return query.find();
                            } else {
                                return;
                            }
                        }, function (error) {
                            console.error("Error saving GSR Test after adding questions to it, error "
                            + JSON.stringify(error));
                        })
                        .then(function (result) {
                            if (result === PromiseHelper.ABORT_CHAIN)
                                return PromiseHelper.ABORT_CHAIN;

                            if (!result || !result[0]) // Doesn't want email, or email not found.
                                return;

                            var email = result[0].get('email');
                            console.log(user.get('name') + " will be emailed with their GSR attempt at " + email);
                            return promises.push(sendEmail('spaced-repetition-system-test-ready',
                                user, email,
                                [{
                                    name: "NUMQUESTIONS",
                                    content: gsrAttempt.get('questions').length
                                }, {
                                    name: "TESTLINK",
                                    content: "http://mycqs.com/mcq/srs/" + gsrAttempt.id
                                }]));
                        });
                },
                function (error) {
                    if (error)
                        console.error("Error looping through SRS subscribed user " + JSON.stringify(error));
                })
                .then(function () {
                    // Wait for pushes and emails to be sent
                    return Parse.Promise.when(promises);
                })
                .then(function () {
                    status.success("Successful");
                },
                function (error) {
                    status.error(JSON.stringify(error));
                    console.error("Error getting Config for SRS, error: " + JSON.stringify(error));
                });
        });
});

//@Deprecated
/**
 * @BackgroundJob operationSortOutACLs
 * Our ACLs were messed up during migration
 * due to Request.User being null with
 * PHP mismanaging currentUser sessionTokens.
 *
 * Therefore, many objects were set with {}
 * ACLs, i.e., completely hidden without
 * masterkey. Sort. It. Out.
 *
 */
/*
 Parse.Cloud.job('operationSortOutACLs', function (request, response) {
 Parse.Cloud.useMasterKey();
 var query = new Parse.Query(Parse.User),
 promises = [],
 numQuestionsWithBadACL = 0,
 user;

 query.get(request.params.userId).then(function (result) {
 user = result;
 if (user)
 console.log("User found: " + user.get('name'));
 query = new Parse.Query("Test");
 query.equalTo('author', user);
 query.include('questions');
 return query.find();
 }).then(function (tests) {
 console.log(user.get('name') + " has " + tests.length + " tests.");
 for (var i = 0; i < tests.length; i++) {
 var test = tests[i],
 questions = test.get('questions');
 console.log("Test " + test.get('title') + " has " + questions.length + " questions.");
 if (!questions)
 continue;
 for (var j = 0; j < questions.length; j++) {
 var question = questions[j];
 if (!question) {
 console.log("question does not exist");
 } else {
 console.log("Checking ACL " + JSON.stringify(question.getACL()));
 var currentACL = question.getACL();
 if (!currentACL ||
 JSON.stringify(currentACL) === '{}' || JSON.stringify(currentACL) === '{"*":{"read":true}}') {
 console.log("BAD ACL match");
 var newACL = new Parse.ACL(user);
 newACL.setPublicReadAccess(true);
 question.setACL(newACL);
 question.set("ACLFixed", true);
 promises.push(question.save());
 numQuestionsWithBadACL++;
 }
 }
 }
 }
 },
 function (error) {
 console.error("Error getting test");
 })
 .then(function () {
 console.log("Waiting for promises " + promises.length);
 return Parse.Promise.when(promises);
 })
 .then(function () {
 response.success(numQuestionsWithBadACL + " questions with bad ACL flagged!");
 }, function (error) {
 response.error(JSON.stringify(error));
 });
 }); */
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
    console.log("Pre Facebook connect for fbid "+authResponse.userID);
    query.equalTo('fbid', authResponse.userID);
    query.find()
        .then(function (results) {
            if(results)
                console.log("PFC results "+results.length);
            if (results[0]) {
                var user = results[0];
                console.log("PFC user found "+user.get('name') + " and id "+user.id);
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
                            console.error("PFC ERROR "+JSON.stringify(error));
                            return response.error({message: error});
                        });
                }
            } else {
                console.log("PFC no user with FBID, success and create new user");
                return response.success();
            }
        },
        function (error) {
            console.error("PFC error with first query "+ JSON.stringify(error));
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

    actionUrl += "?" + actionParams[0].name + "=" + actionParams[0].content;
    for (var i = 1; i < actionParams.length; i++) {
        actionUrl += "&" + actionParams[i].name + "=" + actionParams[i].content;
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
    if (!request.user) {
        response.error();
        return;
    }

    Parse.Cloud.useMasterKey();
    var query = new Parse.Query(Parse.Installation);
    query.equalTo('user', request.user);
    query.count()
        .then(function (count) {
            if (count)
                response.success(true);
            else
                response.success(false);
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
            var subscription = httpResponse,
                privateData = user.get('privateData'),
                startDate = new moment(),
                trialStartDate = new moment(),
                expiryDate = new moment().add(subscription.plan.trial_period_days, 'day')
                    .add(subscription.plan.interval_count, subscription.plan.interval),
                trialExpiryDate = new moment().add(subscription.plan.trial_period_days, 'day');
            privateData.set('stripeSubscription', subscription);
            privateData.set('spacedRepetitionActivated', true);

            privateData.set('spacedRepetitionTrialStartDate', trialStartDate._d);
            privateData.set('spacedRepetitionTrialExpiryDate', trialExpiryDate._d);

            privateData.set('spacedRepetitionStartDate', startDate._d);
            privateData.set('spacedRepetitionExpiryDate', expiryDate._d);
            privateData.set('spacedRepetitionLastPurchase', subscription.plan.interval_count + " " + subscription.plan.interval);
            privateData.set('spacedRepetitionSignupSource', 'Web');
            return privateData.save();
        }).then(function (privateData) {
            response.success({"privateData": privateData});
        },
        function (error) {
            response.error(JSON.stringify(error));
        });
});
/**
 * @CloudFunction Activate SRS for User
 * Either called from iOS, or from the
 * CloudFunction after subscribing users
 * to a Stripe payment plan.
 *
 * Never called directly from Web as
 * activationKey will be seen in Javascript code.
 *
 * @param {String} interval e.g. month, year
 * @param {Integer} intervalLength e.g. 6
 * @param {String} signupSource e.g. iOS, Web
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
        privateData,
        promises = [];

    if (activationKey !== "pacRe6e8rUthusuDEhEwUPEWrUpruhat")
        return response.error("Unauthorized request.");

    user.get('privateData').fetch()
        .then(function (result) {
            privateData = result;
            var startDate = new moment(),
                expiryDate = new moment().add(intervalLength, interval);

            privateData.set('spacedRepetitionActivated', true);
            privateData.set('spacedRepetitionStartDate', startDate._d);
            privateData.set('spacedRepetitionExpiryDate', expiryDate._d);
            privateData.set('spacedRepetitionLastPurchase', intervalLength + " " + interval);
            privateData.set('spacedRepetitionSignupSource', signupSource);
            promises.push(privateData);
            user.set('spacedRepetitionIntensity', 1);
            user.set('spacedRepetitionMaxQuestions', 10);
            user.set('spacedRepetitionNotificationByEmail', true);
            user.set('spacedRepetitionNotificationByPush', true);
            promises.push(user.save());
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

                if (promotionalCode.get('maximumNumberOfUses') >= promotionalCode.get('numberOfRedemptions') && !promotionalCode.get('isInfinite')) {
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
                        var privateData = user.get('privateData');
                        privateData.set('spacedRepetitionActivated', true);
                        var startDate = new moment(),
                            expiryDate = new moment();
                        privateData.set('spacedRepetitionStartDate', startDate._d);
                        privateData.set('spacedRepetitionExpiryDate', expiryDate.add(1, 'month')._d);
                        privateData.set('spacedRepetitionSignupSource', request.params.source);
                        privateData.set('spacedRepetitionLastPurchase', '1 Month');
                        successMessage = "Your Spaced Repetition Service is now activated for 1 month!";
                        promises.push(privateData.save());
                    }
                }
            }
            return Parse.Promise.when(promises);
        })
        .then(function () {
            if (errorMessage)
                return response.error(errorMessage);
            else
                return response.success(successMessage);
        })

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
            if(results[0])
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
});/*
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
    if (!user.get('isProcessed') && user.get('name') && user.get('name').length) {
        /*
         * Create a unique slug
         */
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
            })
            .then(function () {
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
    if (!user.get('isProcessed') && user.get('name') && user.get('name').length) {
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
                // sendEmail('welcome-email', user, privateData.get('email'));
                // user.set('welcomeEmailSent', true)
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

    /*
     * Set ACLs based on privacy if object is not deleted,
     * otherwise the ACL is set later.
     * ACLs for Generated Tests, such as those for SRS, are
     * set in background jobs on creation. Users do not have
     * write access to them.
     */
    if (!request.object.get('isSpacedRepetition') || !request.object.get('isGenerated')) {
        if (!request.object.get('isObjectDeleted')) {
            if (request.object.get('privacy') === 1)
                request.object.setACL(Security.createACLs(request.object.get('author')));
            else
                request.object.setACL(Security.createACLs(request.object.get('author'), false));
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
            author,
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

                if (request.object.get('isGenerated') || !author.get('authData') || !author.get('authData').facebook)
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
            .then(
            function (httpResponse) {
                if (httpResponse) {
                    request.object.set('graphObjectId', httpResponse.data.id);
                }
                response.success();
            },
            function () {
                response.success();
            }
        );
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
        author;

    var query = new Parse.Query(Parse.User);
    query.get(authorObjectId).then(function (result) {
        author = result;
        if (!request.object.existed()) {
            author.increment("numberOfTests");
            var relation = author.relation('savedTests');
            relation.add(request.object);
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
        if (request.object.existed() || !author.get('shareOnCreateTest') || request.object.get('isSpacedRepetition') ||
            request.object.get('isGenerated'))
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