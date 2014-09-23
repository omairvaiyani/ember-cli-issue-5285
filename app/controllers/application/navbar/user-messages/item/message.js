import
Ember
from
'ember';

import
EachItem
from
'../../../../../mixins/each-item';


import
CurrentUser
from
'../../../../../mixins/current-user';

export default
Ember.ObjectController.extend(EachItem, CurrentUser, {
    array: function () {
        return this.get('currentUser.messages');
    }.property('currentUser.messages.length')
});
