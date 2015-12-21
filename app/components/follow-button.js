import Ember from 'ember';

export default Ember.Component.extend({
    classNames: ['inline-block'],

    buttonType: "default",

    defaultButton: function () {
        return !this.get('buttonType') || this.get('buttonType') === "default";
    }.property('buttonType'),

    miniButton: function () {
        return this.get('buttonType') === "mini";
    }.property('buttonType'),

    showFollow: function () {
        return this.get('parentController.showFollow');
    }.property('parentController.showFollow'),

    showUnfollow: function () {
        return this.get('parentController.showUnfollow');
    }.property('parentController.showUnfollow'),

    actions: {
        followUser: function () {
            this.get('parentController').send('followUser', this.get('user'));
        },

        unfollowUser: function () {
            this.get('parentController').send('unfollowUser', this.get('user'));
        }
    }
});
