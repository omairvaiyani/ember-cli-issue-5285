import Ember from 'ember';

export default Ember.Controller.extend({
    plans: [],

    retrievePlans: function () {
        Parse.Cloud.run('listStripePlans', {})
            .then(function(response) {
                //console.dir(response);
                this.set('plans', JSON.parse(response));
            }.bind(this));
    }.on('init'),

    tokenHandler: function (response) {
        Parse.Cloud.run('createSRSCustomer', {email: response.email, card: response.id})
            .then(function() {
            }, function (error) {
                console.dir(error);
            });
    },

    actions: {
        openCheckoutHandler: function (plan) {
            StripeCheckout.open({
                key: 'pk_test_chNbzOLgCjUMKlpjFJPfpmO4',
                image: 'http://assets.mycqs.com/img/mycqs-icon-header-0d5831348b3307fd99c84fb25770b5d0.png',
                address: false,
                currency: 'gbp',
                amount: plan.amount,
                name: 'MyCQs',
                description: 'Spaced Repetition 1 month',
                panelLabel: 'Purchase',
                token: this.get('tokenHandler')
            });
        }
    }
});
