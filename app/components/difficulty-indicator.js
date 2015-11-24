import Ember from 'ember';

export default Ember.Component.extend({
    height: 30,

    width: 60,

    foregroundColor: function () {
        return "#e73a3d";
    }.property(),

    backgroundColor: function () {
        return "#F8C4C5";
    }.property()

});
