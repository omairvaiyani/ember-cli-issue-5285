import Ember from 'ember';

export default Ember.Controller.extend({
    needs: ['application'],

    currentUser: Ember.computed.alias('controllers.application.currentUser'),

    loginMessage: Ember.computed.alias('controllers.application.loginMessage'),

    removeLoginMessages: function () {
        this.set('loginMessage.error', "");
        this.set('loginMessage.connecting', "");
    }.observes('email', 'password')
});
