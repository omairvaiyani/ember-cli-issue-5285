import Ember from 'ember';
import CurrentUser from '../../mixins/current-user';
import ParseHelper from '../../utils/parse-helper';

export default Ember.Controller.extend(CurrentUser, {
    preparingSpacedRepetition: false,

    daysOfTheWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],

    timeZones: function () {
        return moment.tz.names();
    }.property(),

    slotsOfTheDay: function () {
        return this.get('controllers.application.parseConfig.srDailySlots');
    }.property('controllers.application.parseConfig.srDailySlots'),

    srActivatedDidChange: function () {
        if (this.get('currentUser.srActivated'))
            this.send('activateSpacedRepetition');
    }.observes('currentUser.srActivated'),

    // TODO update ember-data to make this work
    /*currentUserDidDirty: function () {

    }.observes('currentUser.isDirty'),*/

    studyIntensityLabel: function () {
        switch (this.get('currentUser.srIntensityLevel')) {
            case "1": case 1: return "Light";
            case "2": case 2: return "Moderate";
            case "3": case 3: return "High";
            default:
                return "Moderate";
        }
    }.property('currentUser.srIntensityLevel'),

    actions: {
        activateSpacedRepetition: function () {
            if (this.get('preparingSpacedRepetition'))
                return;
            this.set('preparingSpacedRepetition', true);
            this.send('incrementLoadingItems');
            ParseHelper.cloudFunction(this, 'activateSpacedRepetitionForUser', {})
                .then(function () {
                    return this.get('currentUser').reload();
                }.bind(this)).then(function () {
                    this.set('preparingSpacedRepetition', false);
                    this.send('decrementLoadingItems');
                    this.get('currentUser').save();
                }.bind(this), function (error) {
                    console.dir(error);
                    this.send('decrementLoadingItems');
                }.bind(this));
        },
        toggleSlot: function (slotIndex, dayIndex) {
            var slot = this.get('currentUser.srDoNotDisturbTimes')[dayIndex].slots[slotIndex];
            Ember.set(slot, 'active', !slot.active);
        }
    }
});
