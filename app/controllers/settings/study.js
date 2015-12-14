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

    /**
     * @Property Current User Did Dirty
     * Checks current user for direct
     * changes. Internal object changes
     * are not monitored by default:
     * only extra property to check
     * is the do not disturb array -
     * see actions.toggleSlot
     */
    currentUserDidDirty: function () {
        return this.get('currentUser.isDirty') || this.get('srDoNotDisturbTimesAltered');
    }.property('currentUser.isDirty', 'srDoNotDisturbTimesAltered'),

    studyIntensityLabel: function () {
        switch (this.get('currentUser.srIntensityLevel')) {
            case "1":
            case 1:
                return "Light";
            case "2":
            case 2:
                return "Moderate";
            case "3":
            case 3:
                return "High";
            default:
                return "Moderate";
        }
    }.property('currentUser.srIntensityLevel'),

    actions: {

        activateSpacedRepetition: function () {
            this.get('preparingSpacedRepetition');
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

            // For isDirty/Saving purposes
            this.set('srDoNotDisturbTimesAltered', true);
        },

        saveChanges: function (callback) {
            var promise = this.get('currentUser').save().then(function () {
                // For isDirty/Saving purposes
                this.set('srDoNotDisturbTimesAltered', false);

                var notification = {
                    type: "saved",
                    title: "Changes Saved!"
                };

                this.send('addNotification', notification);
                window.scrollTo(0, 0)
            }.bind(this), function (error) {
                var notification = {
                    type: "error",
                    title: "Error!",
                    message: error.error
                };
                this.send('addNotification', notification);
            }.bind(this));

            if(callback)
                callback(promise);
        }
    }
});
