import
Ember
from
'ember';

import
CurrentUser
from
'../mixins/current-user';

export default
Ember.ObjectController.extend(CurrentUser, {
    isCurrentUser: function () {
        if (!this.get('currentUser'))
            return true;
        else
            return this.get('author.id') === this.get('currentUser.id');
    }.property('currentUser.id', 'author.id'),

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
        return this.get('currentUser.following').contains(this.get('author.content'));
    }.property('currentUser.following.length', 'author.id')
});
