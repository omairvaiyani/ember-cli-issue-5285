import Ember from 'ember';

import CurrentUser from '../../mixins/current-user';

/*
 * DEPRECATED!
 */

export default Ember.Controller.extend(CurrentUser, {
    selectedCurrency: "usd",
    isSelectedCurrencyGBP: false,
    isSelectedCurrencyUSD: true,
    //isSelectedCurrencyEUR: false,

    plans: [],

    gbpPlans: function () {
        var plans = this.get('plans');
        if (!plans)
            return [];
        var gbpPlans = [];
        for (var i = 0; i < plans.length; i++) {
            var plan = plans[i];
            if (plan.currency === "gbp" && plan.id.startsWith("MYL.MCQ.PRM"))
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
            if (plan.currency === "usd" && plan.id.startsWith("MYL.MCQ.PRM"))
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

    subscriptionMessage: "",

    previousSlide: false,
    nextSlide: true,
    actions: {
        openCheckoutHandler: function (callback, plan) {
            var promise = StripeCheckout.open({
                key: 'pk_live_ktE3v0jGmY5oXvPXDcf0qnGc',
                image: 'https://d3uzzgmigql815.cloudfront.net/img/mycqs-icon-header-0d5831348b3307fd99c84fb25770b5d0.png',
                address: false,
                currency: plan.currency,
                amount: plan.amount,
                name: 'MyCQs',
                description: plan.name,
                panelLabel: 'Purchase',
                token: function (token) {
                    Parse.Cloud.run('createStripeCustomer', {
                        email: token.email,
                        card: token.id
                    }).then(function (response) {
                        this.send('beginStripePaymentPlan', response.stripeToken, plan.id);
                    }.bind(this));
                }.bind(this),
                opened: function () {
                    this.set('selectedPlan', plan);
                    this.notifyPropertyChange('plans');
                }.bind(this)
            });
            callback(promise);
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
        },

        beginStripePaymentPlan: function (stripeToken, planId) {
            Parse.Cloud.run('beginStripePaymentPlan', {
                customerId: stripeToken,
                planId: planId
            }).then(function (response) {
                this.send('postUpgradeSetup');
            }.bind(this), function (error) {
                console.dir(error);
            });
        },

        redeemPromoCode: function (callback) {
            this.send('incrementLoadingItems');
            var promise = Parse.Cloud.run('redeemPromoCode', {code: this.get('promoCode'), source: "Web"});
            callback(promise);
            promise.then(function (response) {
                this.set('subscriptionMessage', response);
                this.send('postUpgradeSetup');
            }.bind(this), function (error) {
                this.send('addNotification', 'srs-error', "Error!", error.message);
                this.set('subscriptionMessage', error.message);
                setTimeout(function () {
                    this.set('subscriptionMessage', "");
                }.bind(this), 2500);
                this.send('decrementLoadingItems');
            }.bind(this));
        },

        postUpgradeSetup: function () {
            this.get('currentUser').reload();
            this.get('currentUser.privateData.content').reload();
            this.send('addNotification', 'srs', "SRS Activated!", '');
            this.send('decrementLoadingItems');
            this.transitionToRoute('dashboard');
        }
    }
});
