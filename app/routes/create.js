import Ember from 'ember';

export default Ember.Route.extend({
    model: function () {
        var user = this.get('currentUser');
        if(!user) {
            this.controllerFor('application').transitionToRoute('index');
            return {};
        }
        return this.store.createRecord('test');
    }
});
