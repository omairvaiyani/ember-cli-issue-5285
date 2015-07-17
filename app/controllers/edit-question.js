import Ember from 'ember';
import validateQuestion from '../utils/validate-question';
import EmberParseAdapter from '../adapters/parse';
import ParseHelper from '../utils/parse-helper';
import CurrentUser from '../mixins/current-user';
/*
 * EditQuestionController for the following routes:
 * - edit.newQuestion
 * - editQuestion
 */
export default Ember.Controller.extend(CurrentUser, {
    needs: ['application', 'create'],

    featherEditor: null,

    initializeFeatherEditor: function () {
        var featherEditor = new Aviary.Feather({
            apiKey: 'f1e1a7583f443151',
            apiVersion: 3,
            theme: 'light', // Check out our new 'light' and 'dark' themes!
            tools: ['text', 'draw', 'crop', 'resize', 'orientation', 'brightness'],
            appendTo: '',
            fileFormat: 'jpg',
            enableCORS: true,
            maxSize: '1000',
            onSave: function (imageID, newURL) {
                var base64 = $('#avpw_canvas_element')[0].toDataURL("image/jpeg", 0.8),
                    base64String = base64.replace(/^data:image\/(png|jpeg);base64,/, "");
                this.set('imageFile.base64', base64String);
                this.set('imageFile.url', newURL);
                this.set('imageFile.style', "background-image:url('" + newURL + "');");
                this.get('featherEditor').close();
            }.bind(this),
            onError: function (errorObj) {
                alert(errorObj.message);
            }
        });
        this.set('featherEditor', featherEditor);
    }.observes('model.id'),

    imageFile: function () {
        if (this.get('model.image'))
            return {
                name: 'image', url: this.get('model.image.url'), base64: null,
                style: "background-image:url('" + this.get('model.image.url') + "');"
            };
        else
            return {name: 'image', url: '', base64: null, style: ''};
    }.property('model.image'),

    loadingItems: function () {
        return this.get('controllers.application.loadingItems');
    }.property('controllers.application.loadingItems.length'),
    saving: false,
    updating: false,

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
        addOption: function () {
            var options = this.get('model.options');
            options.pushObject(App.Option.create({
                phrase: "",
                isTrue: false
            }));
            this.set('canAddMoreOptions', false);
        },
        saveQuestion: function (shouldCheckValidity) {
            if (this.get('saving') || shouldCheckValidity && !this.isQuestionValid())
                return;
            this.send('incrementLoadingItems');
            this.set('saving', true);

            window.scrollTo(0, 0);
            this.send("refreshRoute");
            this.set('isPublic', this.get('test.isPublic'));
            /*
             * If user added an image,
             * save that first, add it to the question,
             * then save the question
             */
            if (this.get('imageFile.base64.length')) {
                // TODO deal with images properly, look at the else part (cloud function to save)
                /*
                 * Check if our temporary imageFile object has been used
                 * If so, use the Parse SDK to save the image first.
                 * Then, use the returned url and name to create an
                 * EmberParseAdapter.File object and set it on the
                 * question.image property.
                 */
                var parseFile = new Parse.File('image.jpg', {base64: this.get('imageFile.base64')});
                return parseFile.save().then(function (image) {
                    var image = new EmberParseAdapter.File(image.name(), image.url());
                    this.set('model.image', image);
                    return this.get('model').save();
                }.bind(this)).
                    then(function (question) {
                        this.get('questions').pushObject(question);
                        return this.get('test').save();
                    }.bind(this)).then(function (test) {
                        this.send('decrementLoadingItems');
                        this.set('saving', false);
                        this.send('addNotification', 'saved', 'Question saved!', 'This test now has '
                            + this.get('questions.length') + ' questions.');
                    }.bind(this));
            } else {
                /*
                 * No image, just save the question
                 */
                var promise = ParseHelper.cloudFunction(this, 'saveNewQuestion', {question: this.get('model'),
                test: ParseHelper.generatePointer(this.get('test'), 'Test')});

                promise.then(function (response) {
                    var question = ParseHelper.extractRawPayload(this.store, 'question', response.question);
                    this.send('newUserEvent', response);
                    this.get('questions').pushObject(question);
                    return this.get('test').save();
                }.bind(this)).then(function () {
                    this.send('decrementLoadingItems');
                    this.set('saving', false);
                }.bind(this), function (error) {
                    console.dir(error);
                });
            }
        },
        updateQuestion: function (shouldCheckValidity) {
            if (this.get('updating') || shouldCheckValidity && !this.isQuestionValid())
                return;

            this.send('incrementLoadingItems');
            this.set('updating', true);

            window.scrollTo(0, 0);
            this.transitionToRoute('edit');

            /*
             * If user added, updated, edited or removed image,
             * save that first then the question.
             */
            if (this.get('imageFile.base64.length')) {
                var parseFile = new Parse.File('image.jpg', {base64: this.get('imageFile.base64')});
                return parseFile.save().then(function (image) {
                    var image = new EmberParseAdapter.File(image.name(), image.url());
                    this.set('model.image', image);
                    return this.get('model').save();
                }.bind(this)).then(function () {
                    this.set('updating', false);
                    this.send('decrementLoadingItems');
                    this.send('addNotification', 'saved', 'Question updated!', 'Your test is up to date.');
                }.bind(this));
            } else {
                this.get('model').save().then(function () {
                    this.set('updating', false);
                    this.send('decrementLoadingItems');
                    this.send('addNotification', 'saved', 'Question updated!', 'Your test is up to date.');
                }.bind(this));
            }
        },
        addImage: function () {
            var oFReader = new FileReader();
            oFReader.readAsDataURL(document.getElementById("questionImageInput").files[0]);

            oFReader.onload = function (oFREvent) {
                var base64 = oFREvent.target.result;
                this.set('imageFile.url', base64);
                this.set('imageFile.base64', base64);
                this.set('imageFile.style', "background-image:url('" + base64 + "');");
                this.send('editImage');
            }.bind(this);
        },
        viewImage: function () {
            this.set('modalImageUrl', this.get('imageFile.url'));
            this.send('openModal', 'application/modal/image', 'edit-question');
        },
        editImage: function () {
            this.get('featherEditor').launch({
                image: 'question-image-holder',
                url: this.get('imageFile.url')
            });
        },
        removeImage: function () {
            document.getElementById("fileInput").value = '';
            this.set('imageFile.url', '');
            this.set('imageFile.base64', '');
            this.set('imageFile.style', '');
            this.set('model.image', null);
        }
    }
});