import Ember from 'ember';
import CurrentUser from '../../../mixins/current-user';
export default Ember.ObjectController.extend(CurrentUser, {
    isCurrentUsersTest: function() {
        if(this.get('author.id') === this.get('currentUser.id'))
            return true;
        else
            return false;
    }.property('author.id')
});
