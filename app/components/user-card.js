import Ember from 'ember';

export default Ember.Component.extend({
    currentUser: function () {
        return this.get('parentController.currentUser');
    }.property('parentController.currentUser'),

    isThisTheCurrentUser: function () {
        return this.get('currentUser.id') === this.get('user.id');
    }.property('currentUser'),

    showMenuOverFlow: function () {
        return false;
    }.property(),

    showProfilePicture: function () {
        return true;
    }.property(),

    actions: {
        openModal: function () {
        }
    }
});
