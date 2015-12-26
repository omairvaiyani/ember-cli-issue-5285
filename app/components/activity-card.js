import Ember from 'ember';

export default Ember.Component.extend({
    joinedActivity: function () {
        return this.get('activity.verb') === "joined";
    }.property("activity.verb"),

    attemptActivity: function () {
        return this.get('activity.verb') === "took quiz";
    }.property("activity.verb"),

    followActivity: function () {
        return this.get('activity.verb') === "followed";
    }.property("activity.verb"),

    createdTestActivity: function () {
        return this.get('activity.verb') === "created quiz";
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
