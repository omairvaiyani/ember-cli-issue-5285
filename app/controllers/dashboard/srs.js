import Ember from 'ember';
import CurrentUser from '../../mixins/current-user';
import ParseHelper from '../../utils/parse-helper';

export default Ember.Controller.extend(CurrentUser, {
    parseConfig: null,

    getIntensityConfig: function () {
        if (!this.get('currentUser'))
            return;
        Parse.Config.get()
            .then(function (config) {
                this.set('parseConfig', config);
            }.bind(this));
    }.on('init'),

    intensityDescription: function () {
        if (!this.get('intensityConfig'))
            return;
        return this.get('intensityConfig').name + " - " + this.get('intensityConfig').description;
    }.property('intensityConfig'),

    intensityConfig: function () {
        if (!this.get('parseConfig'))
            return;
        console.dir(this.get('parseConfig'));
        return this.get('parseConfig').get('spacedRepetitionIntensityLevels')
            [this.get('currentUser.spacedRepetitionIntensity') - 1];
    }.property('parseConfig', 'currentUser.spacedRepetitionIntensity'),

    intensityTimes: function () {
        if (!this.get('intensityConfig'))
            return;
        return this.get('intensityConfig').times;
    }.property('intensityConfig'),

    srsTest: null,

    getSRSTest: function () {
        if (!this.get('currentUser'))
            return;
        var where = {
            author: ParseHelper.generatePointer(this.get('currentUser'), '_User'),
            isSpacedRepetition: true
        };
        this.store.findQuery('test', {where: JSON.stringify(where)})
            .then(function (results) {
                if (results && results.objectAt(0))
                    this.set('srsTest', results.objectAt(0));
            }.bind(this));
    }.on('init'),

    uniqueResponses: Ember.A(),
    getUniqueResponses: function () {
        if (!this.get('srsTest.questions.length'))
            return;
        var where = {
            user: ParseHelper.generatePointer(this.get('currentUser'), '_User'),
            question: {
                "$in": ParseHelper.generatePointers(this.get('srsTest.questions'))
            }
        };
        this.store.findQuery('unique-response', {where: JSON.stringify(where)})
            .then(function (results) {
                this.get('uniqueResponses').clear();
                if (results)
                    this.get('uniqueResponses').addObjects(results);
            }.bind(this));
    }.observes('srsTest.questions.length'),

    selectedBox: null,
    uniqueResponsesInSelectedBox: Ember.A(),

    questionListStyle: function () {
        switch (this.get('selectedBox')) {
            case 1:
                return "background-color:rgb(233, 248, 250);";
            case 2:
                return "background-color:rgb(211, 241, 245);";
            case 3:
                return "background-color:rgb(169, 231, 239);";
            case 4:
                return "background-color:rgb(112, 214, 228);";
        }

    }.property('selectedBox'),

    actions: {
        saveChangesToCurrentUser: function () {
            this.get('currentUser').save()
                .then(function () {
                    this.send('addNotification', 'save', 'Changes saved!');
                }.bind(this));
        },
        selectBox: function (box, uniqueResponsesInSelectedBox) {
            this.set('selectedBox', box);
            this.set('uniqueResponsesInSelectedBox', uniqueResponsesInSelectedBox);
        }
    }


});
