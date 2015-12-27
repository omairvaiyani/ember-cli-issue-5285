import Ember from 'ember';
import ParseHelper from '../utils/parse-helper';

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
            this.get('parentController').send('openModal', a, b, c);
        },

        toggleLike: function () {
            if (this.get('activity.liked'))
                this.send('unlike');
            else
                this.send('like');
            this.toggleProperty('activity.liked');
        },

        like: function () {
            var newLike = this.get('parentController.store').createRecord('like');
            newLike.set('liker', this.get('parentController.currentUser'));
            newLike.set('activityId', this.get('activity').id);
            newLike.set('activityActor', this.get('activity').actor);
            var activityType;
            switch (this.get('activity').verb) {
                case "took quiz":
                    activityType = "attempt";
                    break;
                case "created quiz":
                    activityType = "test";
                    break;
                case "joined":
                    activityType = "user";
                    break;
                case "followed":
                    activityType = "follow";
                    break;
            }
            newLike.set('activityType', activityType);
            newLike.set(activityType, this.get('activity').object);

            this.get('activity').object.incrementProperty('likes');
            newLike.save().then(function (like) {
            }, function (error) {
                console.dir(error);
                this.get('activity').object.decrementProperty('likes');
            }.bind(this));
        },

        unlike: function () {
            this.get('activity').object.decrementProperty('likes');
        }
    }
});
