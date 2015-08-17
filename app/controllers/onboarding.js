import Ember from 'ember';
import ParseHelper from '../utils/parse-helper';

export default Ember.Controller.extend({
    needs: ['index'],

    user: function () {
        return this.get('controllers.index.onboardUser');
    }.property('controllers.index.onboardUser'),

    currentStepIndex: 0,
    currentStep: function () {
        return this.get('onboardingSteps')[this.get('currentStepIndex')];
    }.property('currentStepIndex'),

    onboardingSteps: ["studyingAt", "moduleTags"],

    onboardingStepTitle: function () {
        switch (this.get('currentStep')) {
            case "studyingAt":
                return "Let us tailor fit your studies";
            case "moduleTags":
                return "Learn what you need to";
        }
    }.property("currentStep"),

    currentStepPartial: function () {
        return "onboarding/" + this.get('currentStep');
    }.property("currentStep.length"),

    currentStepComplete: function () {
        return this.get(this.get('currentStep') + 'StepComplete');
    }.property('studyingAtStepComplete', 'moduleTagsStepComplete', 'currentStep'),

    showAlert: function () {
        if (this.get('currentStep') === "moduleTags")
            return true;
    }.property('currentStep'),

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
        if (this.get('currentStep') !== "moduleTags")
            return;
        setTimeout(function () {
            var input = $("#onboarding-addNewModuleTag");
            if (input)
                input.focus();
        }, 150);
    }.observes('currentStep.length'),

    getEducationCohortAndModuleTags: function () {
        if (this.get('currentStep') !== "moduleTags")
            return;

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
        });

    }.observes('currentStep.length'),

    moduleTagsStepComplete: function () {
        return this.get('user.moduleTags.length');
    }.property('user.moduleTags.length'),

    actions: {
        studyingAt: function (studyingAt) {
            this.set('user.studyingAt', studyingAt);
            if (studyingAt !== "home")
                this.set('showPlaceOfStudyInput', true);
            setTimeout(function () {
                $("#onboarding-placeOfStudy").focus();
            }, 150);
        },

        continueToNextStep: function () {
            this.incrementProperty('currentStepIndex');
        },

        addNewModuleTag: function () {
            if (this.get('newModuleTag.length')) {
                this.get('user.moduleTags').pushObject(this.get('newModuleTag'));
                this.set('newModuleTag', "");
            }
        },

        removeModuleTag: function (index) {
            this.get('user.moduleTags').removeObject(this.get('user.moduleTags').objectAt(index));
        }
    }
});
