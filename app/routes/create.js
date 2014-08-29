import Ember from 'ember';

import
CurrentUser
from
'../mixins/current-user';

export default Ember.Route.extend(CurrentUser, {
    model: function () {
        if(!this.get('currentUser')) {
            this.controllerFor('application').transitionToRoute('index');
            return {};
        }
        return this.store.createRecord('test');
    }
});
