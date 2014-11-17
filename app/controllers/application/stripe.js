import Ember from 'ember';

export default Ember.Controller.extend({
    selectedCurrency: "gbp",
    isSelectedCurrencyGBP: true,
    isSelectedCurrencyUSD: false,
    isSelectedCurrencyEUR: false,

    plans: [],

    gbpPlans: function () {
        var plans = this.get('plans');
        if (!plans)
            return [];
        var gbpPlans = [];
        for (var i = 0; i < plans.length; i++) {
            var plan = plans[i];
            if (plan.currency === "gbp")
                gbpPlans.push(plan);
        }
        return gbpPlans.sort(function (a, b) {
            return a.amount - b.amount;
        });
    }.property('plans.length'),

    usdPlans: function () {
        var plans = this.get('plans');
        if (!plans)
            return [];
        var usdPlans = [];
        for (var i = 0; i < plans.length; i++) {
            var plan = plans[i];
            if (plan.currency === "usd")
                usdPlans.push(plan);
        }
        return usdPlans.sort(function (a, b) {
            return a.amount - b.amount;
        });
    }.property('plans.length'),

    eurPlans: function () {
        var plans = this.get('plans');
        if (!plans)
            return [];
        var eurPlans = [];
        for (var i = 0; i < plans.length; i++) {
            var plan = plans[i];
            if (plan.currency === "eur")
                eurPlans.push(plan);
        }
        return eurPlans.sort(function (a, b) {
            return a.amount - b.amount;
        });
    }.property('plans.length'),

    plansInSelectedCurrency: function () {
        if (this.get('selectedCurrency') === "usd")
            return this.get('usdPlans');
        else if (this.get('selectedCurrency') === "gbp")
            return this.get('gbpPlans');
        else if (this.get('selectedCurrency') === "eur")
            return this.get('eurPlans');
    }.property('selectedCurrency', 'gbpPlans.length', 'usdPlans.length'),

    retrievePlans: function () {
        Parse.Cloud.run('listStripePlans', {})
            .then(function (response) {
                this.set('plans', JSON.parse(response));
            }.bind(this));
    }.on('init'),

    actions: {
        openCheckoutHandler: function (plan) {
            plan.isCheckoutLoading = true;
            this.notifyPropertyChange('plans');
            StripeCheckout.open({
                key: 'pk_test_chNbzOLgCjUMKlpjFJPfpmO4',
                image: 'https://d3uzzgmigql815.cloudfront.net/img/mycqs-icon-header-0d5831348b3307fd99c84fb25770b5d0.png',
                address: false,
                currency: plan.currency,
                amount: plan.amount,
                name: 'MyCQs',
                description: plan.name,
                panelLabel: 'Purchase',
                token: function (token) {
                    Parse.Cloud.run('createSRSCustomer', {
                        email: token.email,
                        card: token.id
                    })
                        .then(function (response) {
                            // Card token stored on Parse/Stripe
                            // Time to make subscription/invoice
                            // And activate SRS
                            return Parse.Cloud.run('subscribeCustomerToSRS', {
                                customerId: response.customerId,
                                planId: plan.id
                            });
                        },
                        function (error) {
                            console.dir(error);
                        })
                        .then(function (response) {
                            // All done, response is privateData
                            console.dir(response);
                        }.bind(this));
                }.bind(this),
                opened: function () {
                    this.set('selectedPlan', plan);
                    plan.isCheckoutLoading = false;
                    this.notifyPropertyChange('plans');
                }.bind(this)
            });
        },

        selectCurrency: function (currency) {
            if (currency !== this.get('selectedCurrency')) {
                this.set('isSelectedCurrencyUSD', false);
                this.set('isSelectedCurrencyGBP', false);
                this.set('isSelectedCurrencyEUR', false);
            }
            this.set('selectedCurrency', currency);

            if (currency === "usd") {
                this.set('isSelectedCurrencyUSD', true);
            } else if (currency === "gbp") {
                this.set('isSelectedCurrencyGBP', true);
            } else if (currency === "eur") {
                this.set('isSelectedCurrencyEUR', true);
            }
        }
    }
});
