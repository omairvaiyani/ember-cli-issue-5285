import Ember from 'ember';

export default Ember.Component.extend({
    user: null,

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
    }.property('currentUser', 'user.id'),

    showMenuOverFlow: function () {
        return false;
    }.property(),

    showProfilePicture: function () {
        return true;
    }.property(),

    /**
     * @Property showFollow
     *
     * Show the follow button if:
     * - Current User is logged in
     * - This user is not the current user
     * - currentUser.following does not contain this user
     *
     * @returns {boolean}
     */
    showFollow: function () {
        return this.get('currentUser') && !this.get('isThisTheCurrentUser') &&
            (this.get('currentUser.following') &&
            (!this.get('currentUser.following').contains(this.get('user')) &&
                !this.get('currentUser.following').contains(this.get('user.content')))
            );
    }.property('currentUser', 'isThisTheCurrentUser', 'user', 'currentUser.following.length'),
    /**
     * @Property showUnfollow
     *
     * Show the unfollow button if:
     * - Current User is logged in
     * - This user is not the current user
     * - showFollow is false
     *
     * @returns {boolean}
     */
    showUnfollow: function () {
        return this.get('currentUser') && !this.get('isThisTheCurrentUser') &&
           this.get('currentUser.following') && !this.get('showFollow');
    }.property('currentUser', 'isThisTheCurrentUser', 'showFollow'),

    actions: {
        openModal: function () {
        },

        followUser: function (user) {
            this.get('parentController').send('followUser', user);
        },

        unfollowUser: function (user) {
            this.get('parentController').send('unfollowUser', user);
        }
    }
});
