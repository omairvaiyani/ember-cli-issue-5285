import Ember from 'ember';
import CurrentUser from '../mixins/current-user';

export default Ember.Controller.extend(CurrentUser, {
    isCurrentUser: function () {
        if (!this.get('currentUser'))
            return true;
        else
            return this.get('model.author.id') === this.get('currentUser.id');
    }.property('currentUser.id', 'model.author.id'),

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
        if (!this.get('currentUser.following'))
            return false;
        return this.get('currentUser.following').contains(this.get('model.author.content'));
    }.property('currentUser.following.length', 'model.author.id')

});
