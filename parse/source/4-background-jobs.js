/*
 * BACKGROUND JOBS
 */

/**
 * @BackgroundJob TEMP Replicate Followers on Stream
 *
 * Call when truncating follower relations on Stream
 *
 */
Parse.Cloud.job('TEMP_replicateFollowersOnStream', function (request, status) {
    Parse.Cloud.useMasterKey();

    var totalFollowingsAdded = 0;

    var userQuery = new Parse.Query(Parse.User);
    userQuery.greaterThan('numberFollowing', 0);
    userQuery.find().then(function (users) {
        var perUserPromise = [];
        _.each(users, function (user) {
            var followingRelationQuery = user.following().query();
            var promise = followingRelationQuery.find().then(function (following) {
                var followPromises = [];
                _.each(following, function (userToFollow) {
                    followPromises.push(Parse.Cloud.run('followUser', {userIdToFollow: userToFollow.id, currentUserId: user.id}));
                    totalFollowingsAdded++;
                });
                return Parse.Promise.when(followPromises);
            });
            perUserPromise.push(promise);
        });
        return Parse.Promise.when(perUserPromise);
    }).then(function () {
        status.success("Added " + totalFollowingsAdded + " follow relations");
    }, function (error) {
        status.error(error);
    });
});