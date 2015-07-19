import Ember from 'ember';
import CurrentUser from '../../mixins/current-user';

export default Ember.Controller.extend(CurrentUser, {
    init: function () {
        var week = [];
        _.each(this.get('daysOfTheWeek'), function (dayName) {
            var day = {
                label: dayName
            };
            _.each(this.get('slotsOfTheDay'), function (slot) {
                day[slot.label] = {
                    time: slot.times,
                    disabled: true,
                    activate: false
                };
            });
            week.push(day);
        }.bind(this));
        this.get('week').clear();
        this.get('week').addObjects(week);
    },

    daysOfTheWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],

    slotsOfTheDay: [{label: "morning", times: "8am - 11am"}, {label: "earlyAfternoon", times: "12pm - 2pm"},
        {label: "lateAfternoon", times: "3pm - 5pm"}, {label: "evening", times: "7pm - 10pm"}],

    week: new Ember.A(),

    updateScheduleBasedOnIntensity: function () {
        this.get('week').forEach(function (day) {

        }.bind(this));
    }.observes('currentUser.srIntensityLevel')
});
