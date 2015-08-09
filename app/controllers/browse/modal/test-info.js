import Ember from 'ember';
import CurrentUser from '../../../mixins/current-user';
import EstimateMemoryStrength from '../../../mixins/estimate-memory-strength';

export default Ember.ObjectController.extend(CurrentUser, EstimateMemoryStrength, {
    isCurrentUser: function () {
        if (!this.get('currentUser'))
            return false;
        else
            return this.get('author.id') === this.get('currentUser.id');
    }.property('model.id'),

    /*
     * Text on the 'Send to Mobile' button
     * It updates when a push is being sent
     * and is finally complete. This way
     * seems bizarre and unclean, but Ember
     * was being annoying and not working
     * properly.
     */
    setDefaultSendToMobileButtonText: function () {
        this.set('sendToMobileButtonText', "Send to Mobile");
    }.observes('model.id'),

    isFollowing: function () {
        if (!this.get('currentUser.following.length'))
            return false;
        return this.get('currentUser.following').contains(this.get('author.content'));
    }.property('currentUser.following.length', 'author.id')
});
