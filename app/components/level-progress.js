import Ember from 'ember';

export default Ember.Component.extend({
    classNames: ['text-right'],
    pointsInLevel: function () {
        return this.get('points') - this.get('level.pointsRequired');
    }.property('points', 'level.pointsRequired'),

    progressInLevel: function () {
        var pointsInLevel = this.get('pointsInLevel'),
            pointsNeeded = this.get('level.pointsToLevelUp');
        return Math.floor((pointsInLevel / pointsNeeded) * 100);
    }.property('pointsInLevel', 'level.pointsToLevelUp'),

    progressStyle: function () {
        return "width:" + this.get('progressInLevel') + "%;";
    }.property('progressInLevel'),

    progressMin: 0,

    progressMax: 100
});
