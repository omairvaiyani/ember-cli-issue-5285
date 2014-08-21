import Ember from 'ember';

export default Ember.Route.extend({
    model: function(params) {
        return this.controllerFor('user').get('tests');
    }
});
