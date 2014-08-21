import
Ember
from
'ember';

export default
Ember.ArrayController.extend({
    facebookFriendsOnMyCQs: [],

    findFacebookFromOnMyCQs: function () {
        if (!this.get('facebookFriends.length'))
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
    }.observes('facebookFriends.length'),

    checkWhoIsAlreadyFollowed: function () {
        if (!this.get('content.length'))
            return;

        this.forEach(function (followingUser) {
            if (this.get('isCurrentUser')) {
                if(followingUser)
                    followingUser.set('isFollowing', true);
            } else if(this.get('currentUserFollowing')) {
                this.get('currentUserFollowing').forEach(function (currentUserFollowingUser) {
                    if (followingUser.get('id') === currentUserFollowingUser.get('id'))
                        followingUser.set('isFollowing', true);
                }.bind(this));
            }
        }.bind(this));


    }.observes('content.length', 'currentUserFollowing.length'),

    actions: {
        followFriend: function (friend) {
            var currentUser = this.get('currentUser');
            currentUser.incrementProperty('numberFollowing');
            friend.incrementProperty('numberOfFollowers');
            friend.set('isFollowing', true);
            if (this.get('isCurrentUser'))
                this.get('content').pushObject(friend);

            Parse.Cloud.run('followUser',
                {
                    mainUser: currentUser.get('id'),
                    userToFollow: friend.get('id')
                }, {
                    success: function (success) {
                    }.bind(this),
                    error: function (error) {
                        console.log("There was an error: " + error);
                        currentUser.decrementProperty('numberFollowing');
                        friend.decrementProperty('numberOfFollowers');
                        friend.set('isFollowing', false);
                    }.bind(this)
                });
        },

        unfollowFriend: function (friend) {
            var currentUser = this.get('currentUser');
            currentUser.decrementProperty('numberFollowing');
            friend.decrementProperty('numberOfFollowers');
            friend.set('isFollowing', false);
            if (this.get('isCurrentUser'))
                this.get('content').removeObject(friend);
            Parse.Cloud.run('unfollowUser',
                {
                    mainUser: currentUser.get('id'),
                    userToUnfollow: friend.get('id')
                }, {
                    success: function (success) {
                    }.bind(this),
                    error: function (error) {
                        console.log("There was an error: " + error);
                        currentUser.incrementProperty('numberFollowing');
                        friend.incrementProperty('numberOfFollowers');
                        friend.set('isFollowing', true);
                    }.bind(this)
                });
        }
    }
});
