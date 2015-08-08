import Ember from 'ember';

export default Ember.Component.extend({
    height: 40,

    width: 80,

    foregroundColor: function () {
        return "#e73a3d";
    }.property(),

    backgroundColor: function () {
        return "#F8C4C5";
    }.property()

});
