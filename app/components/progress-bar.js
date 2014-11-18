import Ember from 'ember';

export default Ember.Component.extend({
    progressBarDanger: function () {
        return this.get('progress') < 40;
    }.property('progress'),

    progressBarWarning: function () {
        return this.get('progress') < 60;
    }.property('progress'),

    progressBarSuccess: function () {
        return this.get('progress') >= 60;
    }.property('progress'),

    progressStyle: function () {
        return "width:" + this.get('progress') + "%;";
    }.property('progress'),

    progressMin: 0,

    progressMax: 100
});
