import
Ember
from
'ember';

import
CurrentUser
from
'../../mixins/current-user';

import
ParseHelper
from
'../../utils/parse-helper';

export default
Ember.Route.extend(CurrentUser, {
    setupController: function (controller, model) {
        controller.set('model', this.modelFor('user'));
        var isCurrentUser = this.get('currentUser.id') === model.get('id');
        controller.set('isCurrentUser', isCurrentUser);
    }
});
