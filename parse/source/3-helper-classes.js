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
    // Moment week starts on Sunday, clearly they're stupid and it should be Monday.
    if (todayIndex < 0)
        todayIndex = 6;

    scheduleForSR.slot = _.find(slots, function (slot) {
        return now.hour() >= slot.start && now.hour() < slot.finish;
    });
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
                if (!scheduleForSR.slot && (now.hour() <= slot.finish || !slotIsToday)) {
                    // Next free slot found
                    scheduleForSR.slot = slot;
                    scheduleForSR.time = _.clone(now).set('hour', slot.start);
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
        } else
            break;
    }

    return scheduleForSR;
};