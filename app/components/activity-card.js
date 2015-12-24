import Ember from 'ember';

export default Ember.Component.extend({
    attemptActivity: function () {
        return this.get('activity.verb') === "took quiz";
    }.property("activity.verb"),

    followActivity: function () {
        return this.get('activity.verb') === "followed";
    }.property("activity.verb"),

    showBeatScore: function () {
        return this.get('attemptActivity');
    }.property('attemptActivity'),

    showViewProfile: function () {
        return this.get('followActivity');
    }.property('followActivity'),

    actions: {
        openModal: function (a, b, c) {
            this.get('parentController').send('openModal',a,b,c);
        }
    }
});
