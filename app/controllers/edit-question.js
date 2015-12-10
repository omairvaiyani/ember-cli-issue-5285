import Ember from 'ember';
import validateQuestion from '../utils/validate-question';
import ParseHelper from '../utils/parse-helper';
import CurrentUser from '../mixins/current-user';
import ImageUpload from '../mixins/image-upload';
import ParseFile from 'ember-parse-adapter/file';
/*
 * EditQuestionController for the following routes:
 * - edit.newQuestion
 * - editQuestion
 */
export default Ember.Controller.extend(CurrentUser, ImageUpload, {
    needs: ['application', 'create'],

    // TODO check for deprecation
    loadingItems: function () {
        return this.get('controllers.application.loadingItems');
    }.property('controllers.application.loadingItems.length'),

    // TODO check for deprecation
    saving: false,

    // TODO check for deprecation
    updating: false,

    /**
     * @Property Test
     * @retun {DS.Model<test>}
     */
    test: function () {
        return this.get('controllers.create.model');
    }.property('controllers.create.model'),

    /**
     * @Property Questions
     * @retun {Ember.Array<DS.Model<question>>}
     */
    questions: function () {
        return this.get('controllers.create.model.questions');
    }.property('controllers.create.model.questions.length'),

    setImagePreview: function () {
        this.setDefaultImage(this.get('model.image.secureUrl'));
    }.observes('model.id'),

    // TODO check for deprecation
    isDataLoaded: false,

    // @Deprecated
    canAddMoreOptions: false,

    validity: {
        question: {
            hasErrors: false,
            hasWarnings: false
        },
        stem: {
            errors: [],
            warnings: []
        },
        options: [
            {errors: [], warnings: []},
            {errors: [], warnings: []},
            {errors: [], warnings: []},
            {errors: [], warnings: []},
            {errors: [], warnings: []}
        ]
    },

    // TODO check for efficiency
    isQuestionValid: function () {
        this.send('clearValidity');
        var response = validateQuestion.beginValidation(this.get('model'));
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
            this.send('addNotification', 'warning', 'Woops!', 'Looks like you have some issues with your question!');
            window.scrollTo(0, 0);
            return false;
        }
    },

    // TODO check for efficiency
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

    actions: {
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
        },

        // @Deprecated
        addOption: function () {
            var options = this.get('model.options');
            options.pushObject(App.Option.create({
                phrase: "",
                isTrue: false
            }));
            this.set('canAddMoreOptions', false);
        },

        /**
         * @Action Save Question
         *
         * Runs this.isQuestionValid which handles
         * and displays errors, halting the function
         * if any are found.
         *
         * Sets Question.isPublic to match test.
         * Sets Question.tags to match test.
         * Adds Question to test.questions locally.
         *
         * Checks if Question has image
         * - Saves image asynchronously
         *
         * Saves question using Cloud Code
         * Adds question to test, saves test
         *
         * Displays Points/Badges
         *
         * @param shouldCheckValidity
         * @returns {*}
         */
        saveQuestion: function (shouldCheckValidity) {
            if (this.get('saving') || shouldCheckValidity && !this.isQuestionValid())
                return;

            var question = this.get('model');
            this.send('incrementLoadingItems');
            this.set('saving', true);

            window.scrollTo(0, 0);
            this.send("refreshRoute");

            question.set('isPublic', this.get('test.isPublic'));
            question.set('tags', this.get('test.tags'));

            /*
             * If user added an image, start saving it
             * async. Two save calls will be made.
             */
            if (this.get('imageFile.base64.length')) {
                this.send('uploadImage');
            }
            this.get('questions').pushObject(question);

            ParseHelper.cloudFunction(this, 'saveNewQuestion', {
                question: question,
                test: ParseHelper.generatePointer(this.get('test'), 'Test')
            }).then(function (response) {
                this.get('questions').removeObject(question);
                question = ParseHelper.extractRawPayload(this.store, 'question', response.question);
                this.get('questions').pushObject(question);

                this.send('newUserEvent', response);
                return this.get('test').save();
            }.bind(this)).then(function () {
                this.send('decrementLoadingItems');
                this.set('saving', false);
            }.bind(this), function (error) {
                console.dir(error);
                var notification = {
                    title: "Error Adding Question!",
                    message: error.error,
                    type: "error"
                };
                this.send('addNotification', notification);
                this.get('test').removeObject(this.get('model'));
            }.bind(this));

        },

        /**
         * @Action Update Question
         *
         * Runs this.isQuestionValid which handles
         * and displays errors, halting the function
         * if any are found.
         *
         * Updates Question.tags to match test.
         *
         * Checks if Question has image
         * - Saves image asynchronously
         *
         * Updates question using REST
         *
         * @param shouldCheckValidity
         * @returns {*}
         */
        updateQuestion: function (shouldCheckValidity) {
            if (this.get('updating') || shouldCheckValidity && !this.isQuestionValid())
                return;

            this.send('incrementLoadingItems');
            this.set('updating', true);

            window.scrollTo(0, 0);
            this.transitionToRoute('edit.index');

            this.set('model.tags', this.get('test.tags'));

            /*
             * If user added an image, start saving it
             * async. Two save calls will be made.
             */
            if (this.get('imageFile.base64.length')) {
                this.send('uploadImage');
            }

            /*
             * If user added, updated, edited or removed image,
             * save that first then the question.
             */
            this.get('model').save().then(function () {
                this.set('updating', false);
                this.send('decrementLoadingItems');
                var notification = {
                    type: "saved",
                    title: "Question Updated!",
                    message: "Your test is up to date."
                };
                this.send('addNotification', notification);
            }.bind(this), function (error) {
                console.dir(error);
                var notification = {
                    type: "error",
                    title: "Error Saving Question!",
                    message: error.error
                };
                this.send('addNotification', notification);
            }.bind(this)).then(function () {
               this.set('model', null);
            }.bind(this));
        },

        /**
         * @Action Save Uploaded Image
         *
         * Callback from ImageUploadMixin which is called
         * by this controller when the question is saved.
         *
         * Here, we receive the imageData (name, url),
         * create the correct parse-file transformation,
         * and set it to the current question, and save it.
         * Async from saveQuestion and updateQuestion.
         *
         * @param {Object} imageData
         */
        saveUploadedImage: function (imageData) {
            this.set('model.image', imageData);
            this.get('model').save();
        },

        viewImage: function () {
            this.set('modalImageUrl', this.get('imageFile.url'));
            this.send('openModal', 'application/modal/image', 'edit-question');
        },


        removeImage: function () {
            document.getElementById("imageInput").value = '';
            this.set('imageFile.url', '');
            this.set('imageFile.base64', '');
            this.set('imageFile.style', '');
            this.set('model.image', null);
        }
    }
});