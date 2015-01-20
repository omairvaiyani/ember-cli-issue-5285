import Ember from 'ember';
import PremiumPayment from '../../controllers/application/modal/premium-payment';

export default PremiumPayment.extend({
    needs: ['join'],
    actions: {
        goToNextStep: function (callback) {
            if(this.get('controllers.join.joinStep.addQuestions'))
                this.get('controllers.join').send('goToJoinStep', 'addQuestions', callback);
            else
                this.transitionToRoute('user', this.get('currentUser.slug'));
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
