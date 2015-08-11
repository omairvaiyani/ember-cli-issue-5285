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
       /* if(this.get('isCurrentUser') || !this.get('model.id'))
            return;
        if(!this.get('user.following.length')) {
            EmberParseAdapter.ParseUser.getFollowing(this.store, this.get('model'));
        }
        if(!this.get('user.followers.length')) {
            EmberParseAdapter.ParseUser.getFollowers(this.store, this.get('model'));
        }*/
    }.observes('isCurrentUser', 'model.id'),

    facebookFriendsOnMyCQs: [],

    findFacebookFromOnMyCQs: function () {
        if (!this.get('isCurrentUser') || !this.get('facebookFriends.length'))
            return;

        var where = {
            "fbid": {
                "$in": this.get('facebookFriends')
            }
        };
        this.store.findQuery('parse-user', {where: JSON.stringify(where)})
            .then(function (results) {
                this.get('facebookFriendsOnMyCQs').clear();
                this.get('facebookFriendsOnMyCQs').pushObjects(results.content);
            }.bind(this));
    }.observes('isCurrentUser', 'facebookFriends.length')
});
