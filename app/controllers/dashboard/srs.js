import Ember from 'ember';
import CurrentUser from '../../mixins/current-user';
import ParseHelper from '../../utils/parse-helper';

export default Ember.ObjectController.extend(CurrentUser, {
    parseConfig: null,

    getIntensityConfig: function () {
        if (!this.get('currentUser'))
            return;
        Parse.Config.get()
            .then(function (config) {
                this.set('parseConfig', config);
                this.send('decrementLoadingItems');
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

    timeZones: function () {
        return moment.tz.names();
    }.property(),

    getInstallationTimeZone: function () {
        /*
         * If a timeZone is not set on the User,
         * find their timeZone by using the
         * getInstallationsForUser cloud function
         * which sends back the Parse.Installation
         * array along with timeZones
         */
        if(!this.get('currentUser'))
            return;
        if(this.get('currentUser.timeZone.length'))
            return;
        Parse.Cloud.run('getInstallationsForUser', {})
            .then(function (installations) {
                var installation = installations.objectAt(0);
                if(installation) {
                    this.set('currentUser.timeZone', installation.get('timeZone'));
                } else {
                    // CurrentUser is logged in, has not set a timeZone yet
                    // And has no Parse.Installation to give us one.
                    // Set default to Europe/London
                    this.set('currentUser.timeZone', "Europe/London");
                    return this.get('currentUser').save();
                }
            }.bind(this));
    }.on('init'),

    actions: {
        saveChangesToCurrentUser: function () {
            this.get('currentUser').save()
                .then(function () {
                    this.send('addNotification', 'saved', 'Changes saved!');
                }.bind(this));
        },
        selectBox: function (box, uniqueResponsesInSelectedBox) {
            this.set('selectedBox', box);
            this.set('uniqueResponsesInSelectedBox', uniqueResponsesInSelectedBox);
        },

        cancelSubscriptionToSRS: function () {
            Parse.Cloud.run('unsubscribeUserFromStripePlan', {})
                .then(function (response) {
                }, function (error) {
                    console.dir(error);
                });
        },

        removeAllQuestionsFromSRS: function () {
            window.scrollTo(0, 0);
            this.send('incrementLoadingItems');
            Parse.Cloud.run('addOrRemoveQuestionsToSRSTest', {questionIds: [], task: 3})
                .then(function (response) {
                    this.get('questions').clear();
                    this.send('decrementLoadingItems');
                    this.send('addNotification', 'deleted', "SRS question bank clear.", "You will need to add more questions.");
                }.bind(this), function (error) {
                    console.dir(error);
                    this.send('decrementLoadingItems');
                }.bind(this));
        }
    }


});
