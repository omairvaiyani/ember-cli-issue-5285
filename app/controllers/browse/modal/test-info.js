import
Ember
from
'ember';

import
CurrentUser
from
'../../../mixins/current-user';

export default
Ember.ObjectController.extend(CurrentUser, {
    isCurrentUser: function () {
        if (!this.get('currentUser'))
            return false;
        else
            return this.get('author.id') === this.get('currentUser.id');
    }.property('model.id'),

    isFollowing: function () {
        if(!this.get('currentUser'))
            return false;
        else
            return this.get('currentUser.following').contains(this.get('model.author.content'));
    }.property('currentUser.following.length', 'model.author.id')
});
