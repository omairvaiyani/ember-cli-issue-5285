import Ember from 'ember';

export default Ember.Route.extend({
    renderTemplate: function() {
        this.render('fourOhFour');
        this.send('updateStatusCode', "404");
    },

    deactivate: function () {
        this.send('updateStatusCode', "200");
    }
});
