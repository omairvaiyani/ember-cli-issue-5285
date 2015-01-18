import Ember from 'ember';
import PremiumPayment from '../../controllers/application/modal/premium-payment';

export default PremiumPayment.extend({
    needs: ['join'],
    actions: {
        goToNextStep: function (callback) {
            this.get('controllers.join').send('goToJoinStep', 'addQuestions', callback);
        },
        postUpgradeSetup: function () {
            this.get('controllers.join').send('goToJoinStep', 'addQuestions');
            this.get('currentUser').reload();
            this.get('currentUser.privateData.content').reload();
            this.send('addNotification', 'srs', "Premium Activated!", '');
            this.send('decrementLoadingItems');
            this.send('closeModal');
        }
    }
});
