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

    multipleTargets: function () {
        return this.get('allTargets.length') > 1;
    }.property('allTargets.length'),

    latestActivity: function () {
        return this.get('activity.activities').objectAt(0);
    }.property('activity.activities.length'),

    latestActor: function () {
        return this.get('latestActivity').actor;
    }.property('latestActivity'),

    latestObject: function () {
        return this.get('latestActivity').object;
    }.property('latestActivity'),

    latestTarget: function () {
        return this.get('latestActivity').target;
    }.property('latestActivity'),

    latestTime: function () {
        return this.get('latestObject').time;
    }.property('latestObject'),

    allActors: function () {
        var actors = new Ember.A();
        _.each(this.get('activity.activities'), function (innerActivity) {
            if (!actors.contains(innerActivity.actor))
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

    allTargets: function () {
        var targets = new Ember.A();

        _.each(this.get('activity.activities'), function (innerActivity) {
            if (!targets.contains(innerActivity.target))
                targets.pushObject(innerActivity.target);
        });
        return targets;
    }.property('activity.activities.@each.taget'),

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
