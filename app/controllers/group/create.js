import Ember from 'ember';
import CurrentUser from '../../mixins/current-user';

export default Ember.ObjectController.extend(CurrentUser, {
    setDefaults: function () {
        this.notifyPropertyChange('currentUser.educationCohort');
    }.on('init'),

    isForEducationCohort: function () {
        if (this.get('defaultEducationCohort'))
            return true;
        else
            return false;
    }.property('defaultEducationCohort'),

    /*   isForEducationCohortDidChange: function () {
     if (this.get('isForEducationCohort') && !this.get('defaultEducationCohort')) {
     this.set('defaultEducationCohort', this.store.createRecord('education-cohort'));
     } else if (!this.get('isForEducationCohort'))
     this.set('defaultEducationCohort', null);
     console.log("Is for education cohort? "+this.get('isForEducationCohort'));
     }.observes('isForEducationCohort'),*/

    defaultEducationCohort: null,

    setDefaultEducationCohort: function () {
        if (this.get('id') && !this.get('educationCohort.id'))
            return;

        if (this.get('educationCohort.id')) {
            this.set('defaultEducationCohort', this.store.createRecord('education-cohort', {
                institution: this.get('educationCohort.institution'),
                studyField: this.get('educationCohort.studyField'),
                currentYear: this.get('educationCohort.currentYear'),
                graduation: this.get('educationCohort.graduation')
            }));
            return;
        }

        if (!this.get('currentUser.educationCohort.isFulfilled') && !this.get('currentUser.educationCohort.institution.isFulfilled') && !this.get('currentUser.educationCohort.studyField.isFulfilled'))
            return;
        this.set('defaultEducationCohort', this.store.createRecord('education-cohort', {
            institution: this.get('currentUser.educationCohort.institution'),
            studyField: this.get('currentUser.educationCohort.studyField'),
            currentYear: this.get('currentUser.educationCohort.currentYear'),
            graduation: this.get('currentUser.educationCohort.graduation')
        }));
    }.observes('currentUser.educationCohort', 'currentUser.educationCohort.institution.isFulfilled',
        'currentUser.educationCohort.studyField.isFulfilled'),


    privacyOptions: function () {
        var privacyOptions = [
            {
                value: "open",
                description: "This group will be open to the public. Anyone can view its tests, join the group" +
                " and post comments."
            },
            {
                value: "closed",
                description: "This group will be invite only. The public can find this group and see who's in" +
                " it, but they cannot take tests made for the group."
            },
            {
                value: "secret",
                description: "This group will be hidden from our website and search results. You can share the" +
                " link with others so that they can interact with it as if it was a closed group. Member lists" +
                " will be hidden."
            }];
        switch (this.get('privacy')) {
            case "open":
                privacyOptions[0].isSelected = true;
                break;
            case "closed": // lol
                privacyOptions[1].isSelected = true;
                break;
            case "secret":
                privacyOptions[2].isSelected = true;
                break;
        }
        return privacyOptions;
    }.property('privacy.length'),

    suggestedSlug: function () {
        if (this.get('name.length'))
            return this.get('name').toLowerCase().replace(' - ', ' ').split(' ').join('-');
    }.property('name.length'),

    courseSuggestions: function () {
        return new Ember.A();
    }.property(),

    institutionSuggestions: function () {
        return new Ember.A();
    }.property(),

    studyYearsToChooseFrom: [
        "Foundation Year", "Year 1", "Year 2", "Year 3",
        "Year 4", "Year 5", "Year 6", "Intercalation Year",
        "Master's", "Ph.D", "Professional Education"
    ],

    actions: {
        educationalInstitutionSelected: function (object) {
            var facebookId;
            if (object.recordType === "facebook")
                facebookId = object.id;
            else
                facebookId = object.facebookId;
            Parse.Cloud.run('createOrUpdateEducationalInstitution', {
                name: object.name,
                facebookId: facebookId,
                type: object.category // from facebook // TODO need non-facebook input
            }).then(function (educationalInstitutionParse) {
                return this.store.find('educational-institution', educationalInstitutionParse.id);
            }.bind(this)).then(function (educationalInstitution) {
                this.set('defaultEducationCohort.institution', educationalInstitution);
            }.bind(this), function (error) {
                console.dir(error);
            });
        },

        studyFieldSelected: function (object) {
            var facebookId;
            if (object.recordType === "facebook")
                facebookId = object.id;
            else
                facebookId = object.facebookId;
            Parse.Cloud.run('createOrUpdateStudyField', {
                name: object.name,
                facebookId: facebookId
            }).then(function (studyFieldParse) {
                return this.store.find('study-field', studyFieldParse.id);
            }.bind(this)).then(function (studyField) {
                this.set('defaultEducationCohort.studyField', studyField);
            }.bind(this), function (error) {
                console.dir(error);
            });
        },

        saveChanges: function (callback) {
            var errorMessage;
            if (!this.get('name.length'))
                errorMessage = "Please enter a name for the group!";

            if (errorMessage)
                return this.send('addNotification', 'warning', 'Hold on!', errorMessage);

            var promise,
                promises = [],
                isNewGroup;
            if (this.get('isForEducationCohort') && this.get('defaultEducationCohort')) {
                promise = Parse.Cloud.run('createOrGetEducationCohort', {
                    educationalInstitutionId: this.get('defaultEducationCohort.institution.id'),
                    studyFieldId: this.get('defaultEducationCohort.studyField.id'),
                    currentYear: this.get('defaultEducationCohort.currentYear'),
                    graduationYear: this.get('defaultEducationCohort.graduationYear')
                }).then(function (educationCohortParse) {
                    return this.store.find('education-cohort', educationCohortParse.id);
                }.bind(this)).then(function (educationCohort) {
                    this.set('educationCohort', educationCohort);
                }.bind(this));
                promises.push(promise);
            } else {
                this.set('educationCohort', null);
            }
            promise = Promise.all(promises).then(function () {
                if (!this.get('id')) {
                    isNewGroup = true;
                    this.set('creator', this.get('currentUser'));
                    // Get slug
                    return Parse.Cloud.run('generateSlugForGroup', {groupName: this.get('name')})
                        .then(function (slug) {
                            this.set('slug', slug);
                            return this.get('model').save();
                        }.bind(this));
                } else
                    return this.get('model').save();
            }.bind(this))
                .then(function () {
                    if (isNewGroup)
                        this.transitionToRoute('group', this.get('model.slug'));
                    else {
                        this.send('addNotification', 'saved', 'Group changes saved!');
                        this.send('closeModal');
                    }
                }.bind(this), function (error) {
                    if (error && error.message)
                        return this.send('addNotification', 'warning', 'Something went wrong!', error.message);
                    else
                        return this.send('addNotification', 'warning', 'Something went wrong!', "Please try again later.");
                });
            callback(promise);
        },

        setPrivacy: function (privacy) {
            this.set('privacy', privacy);
        }
    }
});
