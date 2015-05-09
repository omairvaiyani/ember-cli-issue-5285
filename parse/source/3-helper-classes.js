/*
 * HELPER CLASSES
 */

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