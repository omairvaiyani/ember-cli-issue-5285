import Ember from 'ember';

export default Ember.Component.extend({
    defaultCard: function () {
        return !this.get('cardType') || this.get('cardType') === "default";
    }.property('cardType'),

    miniListCard: function () {
        return this.get('cardType') === "miniList" || this.get('userMini');
    }.property('cardType'),

    listCard: function () {
        return this.get('cardType') === "list";
    }.property('cardType'),

    modalCard: function () {
        return this.get('cardType') === "modal";
    }.property('cardType'),

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
