import Ember from 'ember';

export default Ember.Controller.extend({
    needs: ['join'],
    actions: {
        goToNextStep: function () {
            this.get('controllers.join').send('registrationComplete');
        },
        postUpgradeSetup: function () {
            this.get('currentUser').reload();
            this.get('currentUser.privateData.content').reload();
            this.send('addNotification', 'srs', "Premium Activated!", '');
            this.send('decrementLoadingItems');
            this.send('closeModal');
            this.send('goToNextStep');
        }
    }
});
