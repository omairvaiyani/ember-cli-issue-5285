import
Ember
from
'ember';

import
CurrentUser
from
'../../mixins/current-user';

export default
Ember.ObjectController.extend(CurrentUser, {
    getFollowersAndFollowing: function() {
        if(this.get('isCurrentUser') || !this.get('model.id'))
            return;
        if(!this.get('user.following.length')) {
            EmberParseAdapter.ParseUser.getFollowing(this.store, this.get('model'));
        }
        if(!this.get('user.followers.length')) {
            EmberParseAdapter.ParseUser.getFollowers(this.store, this.get('model'));
        }
    }.observes('isCurrentUser', 'model.id')
});
