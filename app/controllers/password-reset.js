import Ember from 'ember';

export default Ember.ObjectController.extend({
    newPassword: '',

    requesting: false,

    passwordResetComplete: false,

    actions: {
        resetPassword: function () {
            if(!this.get('newPassword.length')) {
                alert('Please enter a new password!');
                return;
            }
            this.set('requesting', true);
            this.send('incrementLoadingItems');
            Parse.Cloud.run('setNewPassword', {userObjectId: this.get('id'), password: this.get('newPassword'),
            passwordResetId: this.get('passwordResetId')})
                .then(
                function () {
                    this.send('decrementLoadingItems');
                    alert('Your password was successfully changed!');
                    this.transitionTo('index');
                    this.set('passwordResetComplete', true);
                    this.send('openModal', 'application/modal/login-or-register');
                    this.set('requesting', false);
                }.bind(this),
                function (error) {
                    this.send('decrementLoadingItems');
                    this.set('requesting', false);
                    alert('Something went wrong!');
                    console.dir(error);
                }.bind(this)
            );

        }
    }
});
