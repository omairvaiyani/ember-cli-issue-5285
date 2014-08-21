import Ember from 'ember';

export default Ember.Controller.extend({
    currentUser: null,

    facebookAuth: null,

    facebookUserObject: function() {
        if(this.get('facebookAuth')) {
            FB.api('/me', function(response) {
                return response;
            });
        }
    }.property('facebookAuth'),

    loginMessage: {
        error: "",
        connecting: ""
    },

    currentUserChanged: function () {
        var currentUser = this.get('currentUser');

        if (currentUser)
            localStorage.sessionToken = currentUser.get('sessionToken');
        else
            localStorage.clear();

    }.observes('currentUser')
});
