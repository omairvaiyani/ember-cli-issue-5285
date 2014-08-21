import Ember from 'ember';

export default Ember.ObjectController.extend({
    isCurrentUsersTest: function() {
        if(this.get('author.id') === this.get('currentUser.id'))
            return true;
        else
            return false;
    }.property('author.id')
});
