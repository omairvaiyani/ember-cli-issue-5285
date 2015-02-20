import Ember from 'ember';
import CurrentUser from '../mixins/current-user';

export default Ember.Controller.extend(CurrentUser, {
    init: function () {
        this.updateTopicList();
    },

    levelTypes: [
        "Discipline",
        "Specialty",
        "Focus",
        "Topic",
        "SecondaryTopic"
    ],

    levelTypesCamelised: [
        "discipline",
        "specialty",
        "focus",
        "topic",
        "secondaryTopic"
    ],

    disciplines: new Ember.A(),

    specialties: function () {
        var specialties = new Ember.A();
        if (!this.get('selectedDiscipline'))
            return specialties;
        else
            specialties.addObjects(_.find(this.get('disciplines'), function (discipline) {
                return discipline.title === this.get('selectedDiscipline');
            }.bind(this)).levels);
        return _.sortBy(specialties, 'title');
    }.property('selectedDiscipline'),

    focusList: function () {
        var focusList = new Ember.A();
        if (!this.get('selectedSpecialty'))
            return focusList;
        else
            return focusList.addObjects(_.find(this.get('specialties'), function (specialty) {
                return specialty.title === this.get('selectedSpecialty');
            }.bind(this)).levels);
    }.property('selectedSpecialty'),


    topics: function () {
        var topics = new Ember.A();
        if (!this.get('selectedFocus'))
            return topics;
        else
            return topics.addObjects(_.find(this.get('focusList'), function (focus) {
                return focus.title === this.get('selectedFocus');
            }.bind(this)).levels);
    }.property('selectedFocus'),

    secondaryTopics: function () {
        var secondaryTopics = new Ember.A();
        if (!this.get('selectedFocus'))
            return secondaryTopics;
        else
            return secondaryTopics.addObjects(_.find(this.get('topics'), function (topic) {
                return topic.title === this.get('selectedTopic');
            }.bind(this)).levels);
    }.property('selectedTopic'),

    updateTopicList: function () {
        if (this.get('disciplines.length'))
            return;
        /* var params = {};
         if (this.get('selectedDiscipline'))
         params.selectedDiscipline = this.get('selectedDiscipline');
         if (this.get('selectedSpecialty'))
         params.selectedSpecialty = this.get('selectedSpecialty');
         if (this.get('selectedFocus'))
         params.selectedFocus = this.get('selectedFocus');
         if (this.get('selectedTopic'))
         params.selectedTopic = this.get('selectedTopic');
         if (this.get('selectedSecondaryTopic'))
         params.selectedSecondaryTopic = this.get('selectedSecondaryTopic');*/

        this.set('loading', true);
        Parse.Cloud.run('getProfessionalBankTopicList', {}).then(function (result) {
            this.get('disciplines').clear();
            this.set('disciplines', result.levels);
            /*var disciplineList = [],
             specialtyList = [],
             focusList = [],
             topicList = [],
             secondaryTopicList = [];
             this.set('specialties', result.specialtyList);
             this.set('focusList', result.focusList);
             this.set('topics', result.topicList);
             this.set('secondaryTopics', result.secondaryTopicList);
             ;*/
            this.set('loading', false);
        }.bind(this), function (error) {
            this.set('loading', false);
            console.error(error);
        }.bind(this));
    },

    /* throttleUpdateTopicList: function () {
     Ember.run.debounce(this, this.updateTopicList, 50);
     }.observes('selectedDiscipline', 'selectedSpecialty', 'selectedFocus',
     'selectedTopic', 'selectedSecondaryTopic'),*/

    /* totalQuestionsBubbleSize: function () {
     var size = (this.get('totalQuestions')) + 100;
     if (size > 200)
     size = 200;
     return "height:" + size + "px;width:" + size + "px;top:calc(50% - " + (size / 2) + "px);";
     }.property('totalQuestions'),*/

    maxQuestions: 10,

    setMaxQuestions: function () {
        if (this.get('maxQuestions') < 1)
            this.set('maxQuestions', this.get('totalQuestions'));
        else if (this.get('maxQuestions') > this.get('totalQuestions'))
            this.set('maxQuestions', this.get('totalQuestions'));
        else if (this.get('totalQuestions') < 10 && this.get('maxQuestions') > this.get('totalQuestions'))
            this.set('maxQuestions', this.get('totalQuestions'));
        else if (this.get('maxQuestions') > 25)
            this.set('maxQuestions', 25);
    }.observes('totalQuestions', 'maxQuestions'),

    enoughQuestionsForDifficultySelection: function () {
        if (!this.get('difficulty') && this.get('totalQuestions') > 10)
            this.set('difficulty', 'any');
        return this.get('totalQuestions') > 9;
    }.property('totalQuestions'),

    difficulty: "any",

    difficultyLevels: [
        "any",
        "easy",
        "moderate",
        "hard"
    ],

    addedLevels: new Ember.A(),

    totalQuestions: function () {
        var totalQuestions = 0;
        this.get('addedLevels').forEach(function (level) {
            totalQuestions += level.questions;
        });
        return totalQuestions;
    }.property('addedLevels.length'),

    actions: {
        selectLevelInType: function (levelTypeCamelised, level) {
            if (levelTypeCamelised === "Back") {
                var lowestLevelType;
                _.each(this.get('levelTypes'), function (levelType) {
                    if (this.get('selected' + levelType))
                        lowestLevelType = levelType;
                }.bind(this));
                this.send('selectLevelInType', lowestLevelType, this.get('selected' + lowestLevelType));
                return;
            }
            var levelType = levelTypeCamelised.capitalize();
            if (this.get('selected' + levelType) === level) {
                this.set('selected' + levelType, null);
                switch (levelType) {
                    case "Discipline":
                        _.each(this.get('levelTypes'), function (levelType) {
                            this.set('selected' + levelType, null);
                        }.bind(this));
                        break;
                    case "Specialty":
                        _.each(this.get('levelTypes'), function (levelType) {
                            if (levelType !== "Discipline")
                                this.set('selected' + levelType, null);
                        }.bind(this));
                        break;
                    case "Focus":
                        _.each(this.get('levelTypes'), function (levelType) {
                            if (levelType !== "Discipline" && levelType !== "Specialty")
                                this.set('selected' + levelType, null);
                        }.bind(this));
                        break;
                    case "Topic":
                        _.each(this.get('levelTypes'), function (levelType) {
                            if (levelType !== "Discipline" && levelType !== "Specialty" &&
                                levelType !== "Focus")
                                this.set('selected' + levelType, null);
                        }.bind(this));
                        break;
                }
            } else
                this.set('selected' + levelType, level);
        },

        addLevelInType: function (level) {
            if (!this.get('addedLevels').contains(level)) {
                this.get('addedLevels').pushObject(level);
                Ember.set(level, 'isAdded', true);
            } else {
                this.get('addedLevels').removeObject(level);
                Ember.set(level, 'isAdded', false);
            }
        },

        generateTest: function (callback) {
            var difficulty = this.get('difficulty');
            if (difficulty === "any")
                difficulty = null;
            else
                difficulty = difficulty.capitalize();
            var levels = [];
            _.each(this.get('addedLevels'), function (level) {
                levels.push({
                    type: level.levelType,
                    value: level.title
                });
            }.bind(this));
            var promise = Parse.Cloud.run('generateQuestionsFromBank', {
                maxQuestions: this.get('maxQuestions'),
                levels: levels,
                difficulty: difficulty
            });
            callback(promise);
            promise.then(function (generatedAttempt) {
                    this.transitionToRoute('test', generatedAttempt.id);
                }.bind(this),
                function (error) {
                    console.dir(error);
                    this.send('addNotification', 'warning', "Error!", error.message);
                }.bind(this));
        }
    }
});
