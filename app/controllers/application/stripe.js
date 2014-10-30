import Ember from 'ember';

export default Ember.Controller.extend({
    needs: ['application'],

    isStripeInitialized: false,

    initializeStripe: function () {
        if (this.get('isStripeInitialized'))
            returnl
        Stripe.setPublishableKey('pk_test_chNbzOLgCjUMKlpjFJPfpmO4'); // Testing key
        //Stripe.setPublishableKey('pk_live_ktE3v0jGmY5oXvPXDcf0qnGcX'); // Live key
        this.set('isStripeInitialized', true);
    }.observes('controllers.application.currentPath'),

    tokenHandler: function (response) {
        console.dir(response);
        console.log("Token received " +response.id);
    },

    actions: {
        openCheckoutHandler: function () {
            StripeCheckout.open({
                key:         'pk_test_chNbzOLgCjUMKlpjFJPfpmO4',
                address:     false,
                amount:      2,
                currency:    'gbp',
                name:        'Spaced Repetition System',
                description: '1 month subscription',
                panelLabel:  'Purchase',
                token:       this.get('tokenHandler')
            })
        }
    }
});
