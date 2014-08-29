import
Ember
from
'ember';

export default
Ember.Controller.extend({
    needs: ['index', 'create'],

    currentUser: null,

    facebookAuth: null,

    facebookUserObject: function () {
        if (this.get('facebookAuth')) {
            FB.api('/me', function (response) {
                return response;
            });
        }
    }.property('facebookAuth'),

    loginUser: {
        email: '',
        password: ''
    },

    loginMessage: {
        error: '',
        connecting: ''
    },

    resetLoginMessage: function() {
        this.set('loginMessage.error', '');
        this.set('loginMessage.connection', '');
    }.observes('loginUser.email.length', 'loginUser.password.length'),

    currentUserChanged: function () {
        var currentUser = this.get('currentUser');

        if (currentUser) {
            localStorage.sessionToken = currentUser.get('sessionToken');
            this.get('controllers.index').set('currentUser', currentUser);
            this.get('controllers.create').set('currentUser', currentUser);
        }
        else
            localStorage.clear();

    }.observes('currentUser'),

    newUser: {
        name: '',
        email: '',
        password: '',
        confirmPassword: ''
    },

    signUpValidationErrors: {
        name: false,
        email: false,
        password: false,
        confirmPassword: false
    },

    resetSignUpValidationErrors: function () {
        this.set('signUpValidationErrors.name', false);
        this.set('signUpValidationErrors.email', false);
        this.set('signUpValidationErrors.password', false);
        this.set('signUpValidationErrors.confirmPassword', false);
    }.observes('newUser.name.length', 'newUser.email.length',
            'newUser.password.length', 'newUser.confirmPassword.length')
});
