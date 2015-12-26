import Ember from 'ember';
import ActivityCard from './activity-card'

export default ActivityCard.extend({
    multipleActivities: function () {
        return this.get('activity.activities.length') > 1;
    }.property('activity.activities.length'),

    multipleActors: function () {
        return this.get('allActors.length') > 1;
    }.property('allActors.length'),

    multipleObjects: function () {
        return this.get('allObjects.length') > 1;
    }.property('allObjects.length'),

    latestActor: function () {
        return this.get('activity.activities').objectAt(0).actor;
    }.property('activity.activities.length'),

    latestObject: function () {
        return this.get('activity.activities').objectAt(0).object;
    }.property('activity.activities.length'),

    latestTime: function () {
        return this.get('activity.activities').objectAt(0).time;
    }.property('activity.activities.length'),

    allActors: function () {
        var actors = new Ember.A();
        _.each(this.get('activity.activities'), function (innerActivity) {
            if (!actors.filterBy('id', innerActivity.actor.get('id')).objectAt(0))
                actors.pushObject(innerActivity.actor);
        });
        return actors;
    }.property('activity.activities.@each.actor'),

    allObjects: function () {
        var objects = new Ember.A();
        _.each(this.get('activity.activities'), function (innerActivity) {
            if (!objects.contains(innerActivity.object))
                objects.pushObject(innerActivity.object);
        });
        return objects;
    }.property('activity.activities.@each.object'),

    actorNames: function () {
        var _this = this;
        var actorNames = _this.linkifyText(_this.get('latestActor.name')),
            actorCount = _this.get('activity.actor_count');
        if (actorCount > 0) {
            _.each(_this.get('allActors'), function (actor, index) {
                if (index === 0)
                    return;

                if (index === (actorCount - 1))
                    actorNames += " and " + _this.linkifyText(actor.get('name'));
                else
                    actorNames += ", " + _this.linkifyText(actor.get('name'));
            });
        }
        return actorNames;
    }.property('allActors.length', 'latestActor'),

    linkifyText: function (text) {
        return "<strong class='linkify'>" + text + "</strong>";
    }


});
