import
Ember
from
'ember';

import
validateQuestion
from
'../utils/validate-question';

/*
 * EditQuestionController for the following routes:
 * - edit.newQuestion
 * - editQuestion
 */
export default
Ember.ObjectController.extend({
    needs: ['create'],

    test: function () {
        return this.get('controllers.create.model');
    }.property('controllers.create.model'),

    questions: function () {
        return this.get('controllers.create.model.questions');
    }.property('controllers.create.model.questions.length'),

    isDataLoaded: false,
    canAddMoreOptions: false,
    validity: {
        question: {
            hasErrors: false,
            hasWarnings: false
        },
        stem: {
            errors: [],
            warnings: [],
        },
        options: [
            {errors: [], warnings: []},
            {errors: [], warnings: []},
            {errors: [], warnings: []},
            {errors: [], warnings: []},
            {errors: [], warnings: []},
        ]
    },
    clearValidity: function () {
        this.set('validity.question.hasErrors', false);
        this.set('validity.question.hasWarnings', false);
        this.set('validity.stem.errors', []);
        this.set('validity.stem.warnings', []);
        for (var i = 0; i < this.get('validity.options.length'); i++) {
            this.set('validity.options.' + i + '.errors', []);
            this.set('validity.options.' + i + '.warnings', []);
        }
    },
    isQuestionValid: function () {
        this.clearValidity();
        var response = validateQuestion.beginValidation(this.get('model'));
        console.dir(response);
        if (response.result === "pass") {
            return true;
        } else {
            if (response.errors.length) {
                this.set('validity.question.hasErrors', true);
                for (var i = 0; i < response.errors.length; i++) {
                    var error = response.errors[i];
                    for (var j = 0; j < error.highlight.length; j++) {
                        var highlight = error.highlight[j];
                        switch (highlight.option) {
                            case -1:
                                this.get('validity.stem.errors').pushObject(error);
                                break;
                            default:
                                this.get('validity.options')[highlight.option].errors.pushObject(error);
                                break;
                        }
                    }
                }
            }
            if (response.warnings.length) {
                this.set('validity.question.hasWarnings', true);
                for (var i = 0; i < response.warnings.length; i++) {
                    var warning = response.warnings[i];
                    for (var j = 0; j < warning.highlight.length; j++) {
                        var highlight = warning.highlight[j];
                        switch (highlight.option) {
                            case -1:
                                this.get('validity.stem.warnings').pushObject(warning);
                                break;
                            default:
                                this.get('validity.options')[highlight.option].warnings.pushObject(warning);
                                break;
                        }
                    }
                }
            }
            return false;
        }
    },
    stemAltered: function () {
        var errors = this.get('validity.stem.errors');
        if (errors.length) {
            this.set('validity.question.hasErrors', false);
            this.set('validity.stem.errors', []);
        }
        var warnings = this.get('validity.stem.warnings');
        if (warnings.length) {
            this.set('validity.question.hasWarnings', false);
            this.set('validity.stem.warnings', []);
        }
    }.observes('stem'),
    tagsStringified: "",
    stringifyTags: function () {
        var tagsStringified = "";
        for (var i = 0; i < this.get('tags.length'); i++) {
            tagsStringified += this.get('tags.' + i) + ", ";
        }
        if (tagsStringified)
            this.set('tagsStringified', tagsStringified.slice('0', -2));
        else
            this.set('tagsStringified', tagsStringified);
    }.observes('content.objectId'),
    actions: {
        optionAltered: function (index) {
            this.set('areOptionsDirty', true);
            /*
             * Handle Error and Warning removals
             */
            /*  DUPLICATE ERROR DETECTION - MUST REMOVE THE OTHER DUPLICATE ERRORS */
            var validityOption = this.get('validity.options.' + index);
            if (validityOption.errors.length) {
                for (var i = 0; i < validityOption.errors.length; i++) {
                    var error = validityOption.errors[i];
                    if (error.title.toLowerCase().indexOf("duplicate") > -1) {
                        /*
                         * Duplicate error detected. If two options are duplicate:
                         * - Remove errors from both options,
                         * Else if more than two options are duplicate:
                         * - Ignore and let the rest of this hook remove ONLY the
                         *   current option's error.
                         */
                        if (error.highlight.length === 2) {
                            for (var j = 0; j < error.highlight.length; j++) {
                                this.set('validity.options.' + error.highlight[j].option + '.errors', []);
                            }
                        }
                    }
                }
            }
            this.set('validity.options.' + index + '.errors', []);
            this.set('validity.options.' + index + '.warnings', []);
            this.set('validity.question.hasErrors', false);
            this.set('validity.question.hasWarnings', false);
            //   this.set('controllers.create.isDirty', true);
//            switch (options.length) {
//                case 2:
//                    if (options[0].phrase && options[1].phrase)
//                        this.set('canAddMoreOptions', true);
//                    break;
//                case 3:
//                    if (options[0].phrase && options[1].phrase && options[2].phrase)
//                        this.set('canAddMoreOptions', true);
//                    else
//                        this.set('canAddMoreOptions', false);
//                    break;
//                case 4:
//                    if (options[0].phrase && options[1].phrase && options[2].phrase && options[3].phrase)
//                        this.set('canAddMoreOptions', true);
//                    else
//                        this.set('canAddMoreOptions', false);
//                    break;
//            }
        },
        addOption: function () {
            var options = this.get('options');
            options.pushObject(App.Option.create({
                phrase: "",
                isTrue: false
            }));
            this.set('canAddMoreOptions', false);
        },
        saveQuestion: function (shouldCheckValidity) {
            if (shouldCheckValidity && !this.isQuestionValid())
                return;
            this.set('tags', this.get('tagsStringified').split(', '));

            var unsavedQuestion = this.get('model'),
                test = this.get('test'),
                questions = this.get('questions'),
                question;

            unsavedQuestion.save()
                .then(function (result) {
                    question = result;
                    questions.pushObject(question);
                    return test.save();
                }).then(function (test) {
                    window.scrollTo(0, 0);
                    this.send("refreshRoute");
                }.bind(this));

            /*this.get('model').save().then(function (question) {
                var test = this.get('controllers.create.model');
                test.get('questions').then(function (questions) {
                    questions.pushObject(question);
                    test.save().then(function (test) {
                        window.scrollTo(0, 0);
                        //this.send("refreshRoute");
                        this.transitionToRoute('editQuestion', question);
                        this.transitionToRoute('edit.newQuestion');
                    }.bind(this));
                }.bind(this));
            }.bind(this));*/
        },
        updateQuestion: function (shouldCheckValidity) {
            if (shouldCheckValidity && !this.isQuestionValid())
                return;
            this.set('tags', this.get('tagsStringified').split(', '));
            this.get('model').save().then(function () {
                window.scrollTo(0, 0);
                this.transitionToRoute('edit');
            }.bind(this));
        }
    }
});