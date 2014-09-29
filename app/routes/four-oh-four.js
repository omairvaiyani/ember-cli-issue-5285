import Ember from 'ember';

export default Ember.Route.extend({
    setupController: function() {
        this.send('updateStatusCode', "404");
    },

    deactivate: function () {
        this.send('updateStatusCode', "200");
    }
});
