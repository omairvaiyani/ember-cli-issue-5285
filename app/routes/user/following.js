import
Ember
from
'ember';

import
ParseHelper
from
'../../utils/parse-helper';

export default
Ember.Route.extend({
    model: function () {
        // Was not working
    },

    setupController: function (controller, model) {
        var where = {
            "$relatedTo": {
                "object": ParseHelper.generatePointer(this.modelFor('user')),
                "key": "following"
            }
        };
        this.store.findQuery('parse-user', {where: JSON.stringify(where)})
            .then(function (results) {
                controller.set('content', results.content);
            });
        var isCurrentUser = true;
        if(this.get('currentUser').get('id') !== this.modelFor('user').get('id')) {
            isCurrentUser = false;
            /*
             * If visiting someone elses page and currentUser is logged in
             * Get currentUser.following to cross check
             */
            if(this.get('currentUser')) {
                var where = {
                    "$relatedTo": {
                        "object": ParseHelper.generatePointer(this.get('currentUser')),
                        "key": "following"
                    }
                };
                this.store.findQuery('parse-user', {where: JSON.stringify(where)})
                    .then(function (results) {
                        controller.set('currentUserFollowing', results.content);
                    });
            }
        }
        controller.set('isCurrentUser', isCurrentUser);
        controller.set('facebookFriends', this.modelFor('user').get('facebookFriends'));
    }
});
