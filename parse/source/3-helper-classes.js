/*
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
};