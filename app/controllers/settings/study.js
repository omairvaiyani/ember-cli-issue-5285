import Ember from 'ember';
import CurrentUser from '../../mixins/current-user';

export default Ember.Controller.extend(CurrentUser, {
    init: function () {
        var week = [];
        _.each(this.get('daysOfTheWeek'), function (dayName) {
            var day = new Ember.Object();
            day.set('label', dayName);
            day.set('activeSlots', 0);
            _.each(this.get('slotsOfTheDay'), function (slot) {
                var slotData = new Ember.Object();
                slotData.set('time', slot.times);
                slotData.set('disabled', true);
                slotData.set('active', false);
                day.set(slot.label, slotData);
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

    maxSlotsPerDay: function () {
        return this.get('currentUser.srIntensityLevel');
    }.property('currentUser.srIntensityLevel'),

    updateScheduleBasedOnIntensity: function () {

        this.get('week').forEach(function (day) {
            day.set('morning.disabled', false);
            day.set('morning.active', true);
            if (this.get('currentUser.srIntensityLevel') > 1) {
                day.set('lateAfternoon.active', true);
                day.set('lateAfternoon.disabled', false);
            }
            if (this.get('currentUser.srIntensityLevel') > 2) {
                day.set('earlyAfternoon.active', true);
                day.set('earlyAfternoon.disabled', false);
            }
            if (this.get('currentUser.srIntensityLevel') > 3) {
                day.set('evening.active', true);
                day.set('evening.disabled', false);
            }
        }.bind(this));

    }.observes('currentUser.srIntensityLevel'),

    setActiveSlotsPerDay: function () {
        console.log("Active slots...");
        this.get('week').forEach(function (day) {
            var activeSlots = 0;
            _.each(this.get('slotsOfTheDay'), function (slot) {
                if (day.get(slot.label + ".active"))
                    activeSlots++;
            });
            console.log(day.get('label')+" "+activeSlots);
            day.set('activeSlots', activeSlots);
        }.bind(this));
    }.observes('week.@each.morning.active', 'week.@each.earlyAfternoon.active',
        'week.@each.lateAfternoon.active', 'week.@each.evening.active')
});
