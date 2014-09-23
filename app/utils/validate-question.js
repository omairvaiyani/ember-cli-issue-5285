export default {
        MINIMUM_QUESTION_LENGTH_WARNING: 5,
        MINIMUM_QUESTION_LENGTH_ERROR: 1,

        MAXIMUM_QUESTION_LENGTH_WARNING: 255,
        MAXIMUM_QUESTION_LENGTH_ERROR: 500,

        STEM: -1,

        GENERIC_WORDS: ['which', 'who', 'what', 'where', 'why', 'the',
        'is', 'a', 'true', 'false', 'are', 'they', 'their', 'were', 'of', 'statement',
        'statements', 'from', 'at', 'by', 'following', 'except', 'all', 'than', 'for', 'and', 'its', 'not'],

        leaveComment: function (title, message, highlight, goodExample, badExample, linkedWith) {
        return {title: title,
            message: message,
            highlight: highlight,
            goodExample: goodExample,
            badExample: badExample,
            linkedWith: linkedWith};
        },


    beginValidation: function (question) {
        var stem = question.get('stem'),
            rawOptions = question.get('options'),
            options = [];

        for (var i = 0; i < rawOptions.length; i++) {
            var rawOption = rawOptions[i];
            /*
             * Only add the first option (correct answer)
             * and any un-empty options
             */
            if (i < 1 || rawOption.phrase)
                options.push(rawOption);
        }
        /*
         * We want at least 1 incorrect answer,
         * empty or not, for proper analysis.
         */
        if (options.length < 2)
            options.push(rawOptions[1]);

        var validationResponse = {};

        validationResponse.warnings = new Array();
        validationResponse.errors = new Array();


        /*
         * Validating Stem for
         *  - Detecting 'fill in the blank'
         *  - Stem character count
         */

        /* Detecting 'fill in the blank' */
        // discourage 'fill in the blank' type stems as these are not as good as a self contained question
        if (stem.indexOf("___") != -1) {
            validationResponse.errors.push(
                this.leaveComment(
                    "Try to avoid fill in the blank style questions as these are not as effective",
                    "To improve your question, re-write it as a self contained sentence",
                    [
                        {
                            option: this.STEM,
                            start: 0,
                            length: stem.length
                        }
                    ],
                    "_____ are commonly used in the treatment of arthritis",
                    "Which of the following drugs are commonly used in the treatment of arthritis?"));
        }

        /* Stem character count */
        // Errors for too short or too long
        // Warnings for being outside of the optimum

        // ERROR IF TOO SHORT
        if (stem.length < this.MINIMUM_QUESTION_LENGTH_ERROR) {
            if (stem) {
                validationResponse.errors.push(
                    this.leaveComment(
                        "Your question is too short",
                        "The best questions are  longer than that",
                        [
                            {
                                option: this.STEM,
                                start: 0,
                                length: stem.length
                            }
                        ],
                        "",
                        "")
                );
            } else {
                validationResponse.errors.push(
                    this.leaveComment(
                        "You haven't written a question yet!",
                        "Please write a question to save it.",
                        [
                            {
                                option: this.STEM,
                                start: 0,
                                length: 0
                            }
                        ],
                        "",
                        "")
                );
            }
        }

        // Warning if slightly short
        else if (stem.length < this.MINIMUM_QUESTION_LENGTH_WARNING) {
            validationResponse.warnings.push(
                this.leaveComment(
                    "Your question seems a little short.",
                    "Are you sure it's alright?",
                    [
                        {
                            option: this.STEM,
                            start: 0,
                            length: stem.length
                        }
                    ],
                    "",
                    "")
            );
        }

        // ERROR IF TOO LONG
        else if (stem.length > this.MAXIMUM_QUESTION_LENGTH_ERROR) {
            validationResponse.errors.push(
                this.leaveComment(
                    "Your question is too long!",
                    "Consider shortening it",
                    [
                        {
                            option: this.STEM,
                            start: 0,
                            length: stem.length
                        }
                    ],
                    "",
                    "")
            );
        }

        // Warning if too long
        else if (stem.length > this.MAXIMUM_QUESTION_LENGTH_WARNING) {
            validationResponse.warnings.push(
                this.leaveComment(
                    "Your question seems a little wordy.",
                    "Are you sure it's alright?",
                    [
                        {
                            option: this.STEM,
                            start: 0,
                            length: stem.length
                        }
                    ],
                    "",
                    "")
            );
        }

        /*
         * Validating Options for
         *  - Empty option phrases
         *  - Number of options (unused at the moment)
         *  - Duplicate options
         *  - Detecting 'All/None of the above' options
         *  - Heterogenous options (phrase length disparity)
         *  - Meaningfulness of stem (generic word usage)
         */

        /* Empty option phrases */
        // ERROR FOR MISSING OPTION PHRASES
        for (var i = 0; i < options.length; i++) {
            var option = options[i];
            if (!option.phrase) {
                var title = "Empty answer!";
                var message = "Please type in an answer here or delete this option.";
                if (i === 1)
                    message = "Please type in an answer here.";
                if (option.isCorrect) {
                    title = "Correct answer missing!";
                    message = "Please type in a correct answer here."
                }
                validationResponse.errors.push(
                    this.leaveComment(
                        title,
                        message,
                        [
                            {
                                option: i,
                                start: 0,
                                length: 0
                            }
                        ],
                        "",
                        "")
                );
            }
        }

        /* Number of options (unused at the moment */
        // ERROR IF TOO MANY OPTIONS
        // Front-end does not allow too many options
        if (options.length > 5) {
            validationResponse.errors.push(
                this.leaveComment(
                    "You have too many options!",
                    "The best questions have 3-5 well-chosen options",
                    [
                        {
                            option: this.STEM,
                            start: 0,
                            length: options[options.length - 1].length
                        }
                    ],
                    "",
                    "")
            );
        }
        if (options.length < 3) {
            validationResponse.warnings.push(
                this.leaveComment(
                    "You have too few options!",
                    "The best questions have 3-5 well-chosen options",
                    [
                        {
                            option: this.STEM,
                            start: 0,
                            length: options[options.length - 1].length
                        }
                    ],
                    "",
                    "")
            );
        }

        /* Duplicate options */
        var duplicatesFound = [];
        loop1:
            for (var i = 0; i < options.length; i++) {
                if(duplicatesFound.indexOf(i) > -1)
                    continue;
                var currentOption = options[i].phrase.trim();
                // Best to consider case-insensitive matches
                // as different options, in case the question
                // requires case-sensitive options.
                // currentOption.toLowerCase();
                /*
                 * Ignore currentOption if the phrase is empty:
                 * avoids duplication alerts - the overriding
                 * error will be the empty phrase.
                 */
                if (!currentOption)
                    continue;
                loop2:
                    for (var j = 0; j < options.length; j++) {
                        if (j == i) continue;

                        var comparedOption = options[j].phrase.trim();
                        //comparedOption.toLowerCase();
                        if (comparedOption === currentOption) {
                            validationResponse.errors.push(
                                this.leaveComment(
                                    "Duplicate answers detected",
                                    "Make sure each of your options are unique",
                                    [
                                        {option: i, start: 0, length: currentOption.length},
                                        {option: j, start: 0, length: comparedOption.length}
                                    ],
                                    "",
                                    "")
                            );
                            duplicatesFound.push(i);
                            duplicatesFound.push(j);
                            // There may be more than one set of duplicates, do not break loop1
                            break loop2;
                        }
                    }
            }

        /* Detecting 'All/None of the above' options */
        // ERROR IF FOUND
        for (var i = 0; i < options.length; i++) {
            var option = options[i];
            if (option.phrase.toLowerCase().indexOf("all of the above") != -1) {
                validationResponse.errors.push(
                    this.leaveComment(
                        "Avoid using 'All of the above' answers.",
                        "Answers are randomised and so this will not make sense. Also, students can guess these easily!",
                        [
                            {
                                option: i,
                                start: option.phrase.toLowerCase().indexOf("all of the above"),
                                length: 16
                            }
                        ],
                        "",
                        "")
                );
                break;
            }
            else if (option.phrase.toLowerCase().indexOf("none of the above") != -1) {

                validationResponse.errors.push(
                    this.leaveComment(
                        "Avoid using 'None of the above' answers.",
                        "Answers are randomised and so this will not make sense. Also, students can guess these easily!",
                        [
                            {
                                option: i,
                                start: option.phrase.toLowerCase().indexOf("none of the above"),
                                length: 17}
                        ],
                        "",
                        "")
                );
                break;
            }
        }

        /* Heterogenous options (phrase length disparity) */
        // Warning for too much disparity. The level of disparity by
        // percentage should itself be variable depending on the
        // average character count, i.e. short answers will inherently
        // result in larger percentage disparity than longer answers.
        // For now, just giving a warning, but eventually need to improve
        // this function to be smarter and hand out errors.
        /*
        var charCounts = new Array();
        var totalChars = 0;

        for (var i = 0; i < options.length; i++) {
            var option = options[i];
            charCounts.push(option.phrase.length);
            totalChars += option.phrase.length;
        }

        var averageChars = totalChars / options.length;

        var totalDifference = 0;

        loop1:
            for (var i = 0; i < options.length; i++) {
                var currentOption = options[i].phrase.toLowerCase().trim();
                loop2:
                    for (var j = 0; j < options.length; j++) {
                        if (j == i) continue;

                        var comparedOption = options[j].phrase.toLowerCase().trim();

                        if (comparedOption.length > currentOption.length * 2.00 ||
                            comparedOption.length < currentOption.length * 0.40) {

                            validationResponse.warnings.push(
                                this.leaveComment(
                                    "Answer sizes look really varied!",
                                    "Ideally all your answers should be a similar length.",
                                    [
                                        {
                                            option: i,
                                            start: 0,
                                            length: currentOption.length
                                        },
                                        {
                                            option: j,
                                            start: 0,
                                            length: comparedOption.length
                                        }
                                    ],
                                    "",
                                    "")
                            );
                            break loop1;
                        }
                    }
            }
        */
        /* Meaningfulness of stem (generic word usage) */
        // Warning for using too many generic words.
        var words = stem.replace(/[\.,-\/#!$%\^&\*;:{}=\-_`~()]/g, "")
            .replace(/\s{2,}/g, " ")
            .trim()
            .toLowerCase()
            .split(" ");

        var numberOfGenericWords = 0;

        for (var i = 0; i < words.length; i++) {

            for (var j = 0; j < this.GENERIC_WORDS.length; j++) {
                if (words[i] === this.GENERIC_WORDS[j]) {
                    numberOfGenericWords++;
                }
            }

        }
        var percentageOfWordsThatAreGeneric = (numberOfGenericWords / words.length) * 100;
        if (percentageOfWordsThatAreGeneric > 70) {
            validationResponse.warnings.push(
                this.leaveComment(
                    "Vague question?",
                    "Your question looks a little vague, are you sure it reads well?",
                    [
                        {
                            option: this.STEM,
                            start: 0,
                            length: stem.length
                        }
                    ],
                    "",
                    "")
            );
        }

        if (validationResponse.errors.length > 0) validationResponse.result = "fail";
        else if (validationResponse.warnings.length > 0) validationResponse.result = "warn";
        else validationResponse.result = "pass";

        return validationResponse;

    }
}
