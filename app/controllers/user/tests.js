import Ember from 'ember';
import
CurrentUser
from
'../../mixins/current-user';

export default
Ember.ArrayController.extend(CurrentUser, {
    needs: 'user',

    user: function () {
        return this.get('controllers.user.model');
    }.property('controllers.user.model')
});
