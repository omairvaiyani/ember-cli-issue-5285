import Ember from 'ember';
import CurrentUser from '../mixins/current-user';
import EventTracker from '../utils/event-tracker';

export default Ember.Controller.extend(CurrentUser, {
    needs: ['test'],

    init: function () {
        this.updateLevelsList();
    },

    showGenerator: function () {
        return this.get('currentUser.privateData.hasAccessToBetaQuestionGenerator');
    }.property('currentUser.privateData.hasAccessToBetaQuestionGenerator'),

    verifyingUser: function () {
        console.log(this.get('currentUser.privateData.isFulfilled'));
        return !this.get('currentUser.privateData.isFulfilled');
    }.property("currentUser.privateData.isFulfilled"),

    levelTypes: ["1", "2", "3"],

    levels: new Ember.A(),

    level2: function () {
        var level2 = new Ember.A();
        if (!this.get('selectedLevel1'))
            return level2;
        else
            level2.addObjects(_.find(this.get('levels'), function (level) {
                return level.title === this.get('selectedLevel1');
            }.bind(this)).levels);
        return _.sortBy(level2, 'title');
    }.property('selectedLevel1'),

    level3: function () {
        var level3 = new Ember.A();
        if (!this.get('selectedLevel2'))
            return level3;
        else
            level3.addObjects(_.find(this.get('level2'), function (level) {
                return level.title === this.get('selectedLevel2');
            }.bind(this)).levels);
        return _.sortBy(level3, 'title');
    }.property('selectedLevel2'),

    updateLevelsList: function () {
        if (this.get('levels.length'))
            return;

        this.set('loading', true);
        Parse.Cloud.run('getProfessionalBankTopicList', {}).then(function (result) {
            this.get('levels').clear();
            this.get('levels').addObjects(result.levels);
            this.set('loading', false);
        }.bind(this), function (error) {
            this.set('loading', false);
            console.error(error);
        }.bind(this));
    },

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
            totalQuestions += level.numberOfQuestions;
        });
        return totalQuestions;
    }.property('addedLevels.length'),


    actions: {
        selectLevelInType: function (levelType, level) {
            if (levelType === "Back") {
                var lowestLevelType;
                _.each(this.get('levelTypes'), function (levelType) {
                    if (this.get('selectedLevel' + levelType))
                        lowestLevelType = levelType;
                }.bind(this));
                this.send('selectLevelInType', lowestLevelType, this.get('selectedLevel' + lowestLevelType));
                return;
            }
            if (this.get('selectedLevel' + levelType) === level) {
                this.set('selectedLevel' + levelType, null);
                switch (levelType) {
                    case "1":
                        _.each(this.get('levelTypes'), function (levelType) {
                            this.set('selectedLevel' + levelType, null);
                        }.bind(this));
                        break;
                    case "2":
                        _.each(this.get('levelTypes'), function (levelType) {
                            if (levelType !== "1")
                                this.set('selectedLevel' + levelType, null);
                        }.bind(this));
                        break;
                    case "3":
                        _.each(this.get('levelTypes'), function (levelType) {
                            if (levelType !== "3" && levelType !== "2")
                                this.set('selectedLevel' + levelType, null);
                        }.bind(this));
                        break;
                }
            } else
                this.set('selectedLevel' + levelType, level);
        },

        addLevelInType: function (level) {
            if (!this.get('addedLevels').contains(level)) {
                this.get('addedLevels').pushObject(level);
                Ember.set(level, 'isAdded', true);
            } else {
                this.get('addedLevels').removeObject(level);
                Ember.set(level, 'isAdded', false);
            }
            this.set('maxQuestions', this.get('totalQuestions'));
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
                levels: levels,
                maxQuestions: this.get('maxQuestions'),
                difficulty: this.get('difficulty')
            }).then(function (generatedAttempt) {
                    var eventObject = {
                        numberOfQuestions: generatedAttempt.get('questions').length,
                        levels: []
                    };
                    _.each(this.get('addedLevels'), function (level) {
                        eventObject.levels.push("level", level.levelType + ":" + level.title);
                    });
                    EventTracker.recordEvent(EventTracker.GENERATED_MEDICAL_TEST, eventObject);

                    var attempt;
                    if (!this.get('generateForGroup'))
                        this.transitionToRoute('test', generatedAttempt.id);
                    else
                        return this.store.findById('attempt', generatedAttempt.id)
                            .then(function (result) {
                                attempt = result;
                                var test = this.store.createRecord('test');
                                test.set('group', this.get('generateForGroup'));
                                test.set('title', 'Test for ' + test.get('group.name'));
                                test.set('author', this.get('currentUser'));
                                test.set('isProfessional', true);
                                test.set('isGenerated', true);
                                test.get('questions').addObjects(attempt.get('questions'));
                                return test.save();
                            }.bind(this)).then(function (test) {
                                this.transitionToRoute('test', test.get('slug'));
                                this.set('generateForGroup', null);
                            }.bind(this));

                }.bind(this),
                function (error) {
                    console.dir(error);
                    this.send('addNotification', 'warning', "Error!", error.message);
                }.bind(this));
            callback(promise);
        },

        verifyBetaPasskey: function (callback) {
            var promise = Parse.Cloud.run('grantAccessToQuestionBank', {passkey: this.get('betaPasskey')});
            callback(promise);
            promise.then(function () {
                this.send('addNotification', 'welcome', "Access granted!", "You can now generate medical tests.");
                this.get('currentUser.privateData.content').reload();
            }.bind(this), function (error) {
                this.send('addNotification', 'alert', "Error!", error.message);
            }.bind(this));
        },

        verifyBetaPasskeyEnter: function () {
            Ember.$("#verify-beta-passkey").click();
        }
    }
});
