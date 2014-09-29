import Ember from 'ember';

import
CurrentUser
from
'../../../mixins/current-user';

import
EachItem
from
'../../../mixins/each-item';

export default
Ember.ObjectController.extend(CurrentUser, EachItem, {
    isCurrentUser: function () {
        return this.get('currentUser.id') === this.get('model.id');
    }.property('currentUser.id'),

    isFollowing: function() {
        if(!this.get('isCurrentUser') && this.get('currentUser.following')) {
            return this.get('currentUser.following').contains(this.get('model'));
        }
    }.property('isCurrentUser', 'currentUser.following.length'),

 /*   array: function () {
        return this.get('parentController.tests');
    }.property('parentController.tests.length')*/
});
