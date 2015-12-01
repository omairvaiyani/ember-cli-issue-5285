import Ember from 'ember';
import ParseHelper from '../utils/parse-helper';
import FormValidation from '../utils/form-validation';
import CurrentUser from '../mixins/current-user';
import ImageUpload from '../mixins/image-upload';

export default Ember.Controller.extend(CurrentUser, ImageUpload, {
    needs: ['index'],

    user: function () {
        return this.get('controllers.index.onboardUser');
    }.property('controllers.index.onboardUser'),

    currentStepIndex: 0,

    currentStep: function () {
        return this.get('onboardingSteps')[this.get('currentStepIndex')];
    }.property('currentStepIndex'),

    onboardingSteps: ["studyingAt", "moduleTags", "spacedRepetition", "profileSetup"],

    onboardingStepTitle: function () {
        switch (this.get('currentStep')) {
            case "studyingAt":
                return "Let us tailor fit your studies";
            case "moduleTags":
                return "Keep Organised with Study Modules";
            case "spacedRepetition":
                return "Enable Efficient Learning";
            case "profileSetup":
                if (!this.get('registrationComplete'))
                    return "Almost there!";
                else
                    return "You're all done!";
        }
    }.property("currentStep", "registrationComplete"),

    currentStepPartial: function () {
        return "onboarding/" + this.get('currentStep');
    }.property("currentStep.length"),

    currentStepComplete: function () {
        return this.get(this.get('currentStep') + 'StepComplete');
    }.property('currentStep', 'studyingAtStepComplete', 'moduleTagsStepComplete', 'spacedRepetitionStepComplete',
        'profileSetupStepComplete'),

    onFinalStep: function () {
        return this.get('currentStepIndex') === (this.get('onboardingSteps.length') - 1);
    }.property('currentStepIndex'),

    showBack: function () {
        return this.get('currentStepIndex') > 0 && !this.get('registrationComplete');
    }.property('currentStepIndex', 'registrationComplete'),

    studyOptimizationProgress: function () {
        var progress = 0,
            user = this.get('user');
        if (user.get('studying.length'))
            progress += 14;
        if (user.get('studyingAt.length'))
            progress += 8;
        if (user.get('placeOfStudy.length'))
            progress += 10;
        if (user.get('studyYear.length'))
            progress += 10;
        if (user.get('moduleTags.length')) {
            progress += 8;
            if (user.get('moduleTags.length') > 2)
                progress += 4;
            if (user.get('moduleTags.length') > 4)
                progress += 4;
        }
        if (user.get('srActivated'))
            progress += 25;
        if (this.get('registrationComplete'))
            progress += 17;
        return progress;
    }.property('user.studying.length', 'user.studyingAt.length', 'user.placeOfStudy.length',
        'user.studyYear.length', 'user.moduleTags.length', 'user.srActivated', 'registrationComplete'),

    studyOptimizationBarStyle: function () {
        return "width:" + this.get('studyOptimizationProgress') + "%;";
    }.property('studyOptimizationProgress'),

    /*
     * STEP - Studying At
     */
    showPlaceOfStudyInput: false,
    showStudyYearPicker: false,

    studyYearsToChooseFrom: [
        "Foundation Year", "Year 1", "Year 2", "Year 3",
        "Year 4", "Year 5", "Year 6", "Intercalation Year",
        "Master's", "Ph.D", "Professional Education"
    ],

    placeOfStudyWritten: function () {
        if (!this.get('user.placeOfStudy.length'))
            return;

        if (this.get('user.studyingAt') === "university") {
            this.set('showStudyYearPicker', true);
        }
    },

    placeOfStudyWrittenThrottle: function () {
        Ember.run.debounce(this, this.placeOfStudyWritten, 300);
    }.observes('user.placeOfStudy'),

    studyingAtStepComplete: function () {
        return this.get('user.studying.length') &&
            ( (this.get('user.placeOfStudy.length') && this.get('user.studyYear.length'))
            || (this.get('user.placeOfStudy.length') && this.get('user.studyingAt') !== "university")
            || this.get('user.studyingAt') === "home" );
    }.property('user.studying.length', 'user.placeOfStudy.length', 'user.studyYear.length', 'user.studyingAt.length'),

    /*
     * Module Tags
     */
    focusOnNewModuleTagInput: function () {
        var _this = this;
        if (this.get('currentStep') === "moduleTags") {
            // Wait for element to load into dom
            setTimeout(function () {
                // Focus on new module tag input
                var input = $("#onboarding-addNewModuleTag");
                if (!input)
                    return;
                input.focus();
                // Handler that creates a new module tag
                // if user focuses out of the tag input
                // after having written something.
                input.focusout(function () {
                    if (_this && _this.get('newModuleTag.length'))
                        _this.send('addNewModuleTag');
                });
            }, 150);
        } else {
            // Remove click handlers
            var input = $("#onboarding-addNewModuleTag");
            if (!input)
                return;
            input.off("focusout");
        }
    }.observes('currentStep.length'),

    getEducationCohortAndModuleTags: function () {
        if (this.get('currentStep') !== "moduleTags")
            return;

        if (!this.get('user.studying') && !this.get('user.placeOfStudy'))
            return;

        this.set('fetchingModuleTags', true);
        this.send('incrementLoadingItems');
        ParseHelper.cloudFunction(this, 'getEducationCohort', {
            studyFieldName: this.get('user.studying'),
            institutionName: this.get('user.placeOfStudy'),
            currentYear: this.get('user.studyYear')
        }).then(function (response) {
            var educationCohort = ParseHelper.extractRawPayload(this.store, 'education-cohort', response);
            this.set('user.educationCohort', educationCohort);
            if (educationCohort.get('moduleTags.length'))
                this.get('user.moduleTags').addObjects(educationCohort.get('moduleTags'));
        }.bind(this), function (error) {
            console.dir(error);
        }).then(function () {
            this.set('fetchingModuleTags', false);
            this.send('decrementLoadingItems');
        }.bind(this));

    }.observes('currentStep.length'),

    moduleTagsStepComplete: function () {
        return this.get('user.moduleTags.length');
    }.property('user.moduleTags.length'),

    /*
     * Spaced Repetition
     */
    spacedRepetitionStepComplete: function () {
        return this.get('user.srActivated');
    }.property('user.srActivated'),

    /*
     * Profile Setup
     */
    signUpValidationErrors: function () {
        return this.get('controllers.application.signUpValidationErrors')
    }.property('controllers.application.signUpValidationErrors'),

    profileSetupStepComplete: function () {
        if (this.get('registrationComplete'))
            return true;

        if (this.get('user.name.length') && this.get('user.email.length') && this.get('user.password.length'))
            return true;
        else
            return false;
    }.property('user.name.length', 'user.email.length', 'user.password.length', 'registrationComplete'),

    /**
     * @Property Sign Up Validation has Errors
     * Needed by ApplicationRoute.actions.signUp
     * @return {Boolean}
     */
    signUpValidationHasErrors: function () {
        return this.get('signUpValidationErrors.name.length') || this.get('signUpValidationErrors.email.length')
            || this.get('signUpValidationErrors.password.length');
    }.property('signUpValidationErrors.name.length', 'signUpValidationErrors.email.length',
        'signUpValidationErrors.password.length'),

    resetSignUpValidationErrors: function () {
        this.set('signUpValidationErrors.name', "");
        this.set('signUpValidationErrors.email', "");
        this.set('signUpValidationErrors.password', "");
        this.set('signUpValidationErrors.signUp', "");
    }.observes('user.name.length', 'user.email.length',
        'user.password.length'),

    setProfileImage: function () {
        if (this.get('currentStep') !== "profileSetup")
            return;

        this.set('imageFile.style', "background-image:url('" +
            this.get('user.profileImageURL') + "');");
        this.set('imageFile.url', this.get('user.profileImageURL'));

        if (!this.get('user.profilePicture') && !this.get('user.fbid'))
            this.set('imageFile.isDefault', false);
    }.observes('currentStep'),

    actions: {
        studyingAt: function (studyingAt) {
            this.set('user.studyingAt', studyingAt);
            if (studyingAt !== "home") {
                this.set('showPlaceOfStudyInput', true);
                setTimeout(function () {
                    $("#onboarding-placeOfStudy").focus();
                }, 150);
            } else
                this.send('continueToNextStep');
        },

        continueToNextStep: function () {
            if (this.get('currentStep') === "moduleTags") {
                // Check if new moduleTags have been added
                if (this.get('user.moduleTags.length') && this.get('user.educationCohort'))
                    this.set('user.educationCohort.moduleTags', this.get('user.moduleTags'));
            }
            this.incrementProperty('currentStepIndex');
        },

        goToPreviousStep: function () {
            this.decrementProperty('currentStepIndex');
            if (this.get('currentStep') === "studyingAt") {
                // Reset step
                this.send('resetStudyingAt');
            }
        },

        resetStudyingAt: function () {
            this.set('user.studyingAt', "");
            this.set('user.placeOfStudy', "");
            this.set('showStudyYearPicker', false);
            this.get('user.moduleTags').clear();
            this.set('user.studyYear', "");
        },

        /**
         * ADDING AND REMOVING TAGS
         */
        toggleAddingNewTag: function () {
            if (this.get('newTag.length')) {
                if (!this.get('user.moduleTags'))
                    this.set('user.moduleTags', new Ember.A());
                this.get('user.moduleTags').pushObject(this.get('newTag'));
                this.set('newTag', "");
            }
            this.set('addingTag', !this.get('addingTag'));
            setTimeout(function () {
                if (this.get('addingTag'))
                    Ember.$("#new-tag").focus();
            }.bind(this), 150);
        },

        addNewModuleTag: function () {
            if (this.get('newTag.length')) {
                this.get('user.moduleTags').pushObject(this.get('newTag'));
                this.set('newTag', "");
            }
        },

        removeTag: function (tag) {
            this.get('user.moduleTags').removeObject(tag);
        },

        // Image uploaded to server after
        // user presses "register", we
        // we now need to same the image
        // to the user object.
        saveUploadedImage: function (image) {
            this.send('incrementLoadingItems');
            this.set('user.profilePicture', image);
            // This is converted to a currentUser in the
            // final callback from registration.
        },

        registerWithEmailAsyncButton: function () {
            $("#onboarding-registerWithEmail").click();
        },
        registerUserWithEmail: function (callback) {
            var name = this.get('user.name'),
                email = this.get('user.email'),
                password = this.get('user.password');

            this.set('signUpValidationErrors.name', FormValidation.name(name.trim()));
            this.set('signUpValidationErrors.email', FormValidation.email(email.trim()));
            this.set('signUpValidationErrors.password', FormValidation.password(password.trim()));
            if (!this.get('signUpValidationHasErrors')) {
                // If uploaded image, save it
                if (this.get('imageFile.url') !== this.get('user.profileImageURL')) {
                    this.send('uploadImage'); // receives a callback at actions.savedUploadedImage
                }
                var data = {
                    name: name.capitalize().trim(),
                    username: email.trim(),
                    email: email.trim(),
                    signUpSource: 'Web',
                    password: password
                };
                var redirect = Ember.Object.create({
                    controller: this,
                    returnAction: "registrationComplete"

                });
                this.send('setRedirect', redirect);
                this.send('registerUser', data, callback);
            } else if (callback) {
                callback(new Parse.Promise().resolve());
            }
        },

        registerWithFacebook: function () {
            var redirect = Ember.Object.create({
                controller: this,
                returnAction: "registrationComplete"
            });
            this.send('setRedirect', redirect);
            this.send('facebookConnect');
        },

        registrationComplete: function () {
            this.set('registrationComplete', true);

            this.set('currentUser.educationCohort', this.get('user.educationCohort'));
            this.set('currentUser.profilePicture', this.get('user.profilePicture'));
            this.get('currentUser').save();
        },

        finishOnboarding: function () {
            this.transitionTo('index');
        }
    }
});
