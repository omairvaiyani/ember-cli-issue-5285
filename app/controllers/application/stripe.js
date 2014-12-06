import Ember from 'ember';

import CurrentUser from '../../mixins/current-user';

export default Ember.Controller.extend(CurrentUser, {
    selectedCurrency: "gbp",
    isSelectedCurrencyGBP: true,
    isSelectedCurrencyUSD: false,
    isSelectedCurrencyEUR: false,
    isCheckoutLoading: false,

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

    subscriptionMessage: "",

    previousSlide: false,
    nextSlide: true,
    actions: {
        swipeNext: function () {
            this.set('previousSlide', true);
            this.get('touchSlider').swipeNext();
            if(this.get('touchSlider').activeIndex === (this.get('touchSlider').slides.length - 1))
                this.set('nextSlide', false);
        },
        swipePrev: function () {
            this.set('nextSlide', true);
            this.get('touchSlider').swipePrev();
            if(this.get('touchSlider').activeIndex === 0)
                this.set('previousSlide', false);
        },
        openCheckoutHandler: function (plan) {
            plan.isCheckoutLoading = true;
            this.notifyPropertyChange('plans');
            StripeCheckout.open({
                //key: 'pk_test_chNbzOLgCjUMKlpjFJPfpmO4',
                key: 'pk_live_ktE3v0jGmY5oXvPXDcf0qnGc',
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
                            this.send('addNotification', 'warning', 'Something went wrong!',
                                'Please try again, you have not been charged.');
                        }.bind(this))
                        .then(function (response) {
                            // All done, response is privateData
                            this.set('subscriptionMessage', "Spaced Repetition Service Activated!");
                            this.set('currentUser.privateData.spacedRepetitionActivated', true);
                            this.set('currentUser.privateData.spacedRepetitionStartDate',
                                response.privateData.get('spacedRepetitionStartDate'));

                            this.set('currentUser.privateData.spacedRepetitionTrialStartDate',
                                response.privateData.get('spacedRepetitionTrialStartDate'));

                            this.set('currentUser.privateData.spacedRepetitionExpiryDate',
                                response.privateData.get('spacedRepetitionExpiryDate'));

                            this.set('currentUser.privateData.spacedRepetitionTrialExpiryDate',
                                response.privateData.get('spacedRepetitionTrialExpiryDate'));

                            this.set('currentUser.privateData.spacedRepetitionLastPurchase',
                                response.privateData.get('spacedRepetitionLastPurchase'));

                            this.set('currentUser.privateData.spacedRepetitionSignupSource',
                                response.privateData.get('spacedRepetitionSignupSource'));

                            this.set('currentUser.spacedRepetitionNotificationByEmail', true);
                            this.set('currentUser.spacedRepetitionNotificationByPush', true);
                            this.set('currentUser.spacedRepetitionIntensity', 1);
                            this.set('currentUser.spacedRepetitionNotificationMaxQuestions', 10)
                            this.get('currentUser').save();
                            this.transitionTo('dashboard.srs');
                        }.bind(this),
                        function (error) {
                            console.dir(error);
                            this.send('addNotification', 'warning', 'Something went wrong!',
                                'Please try again, you have not been charged.');
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
        },

        redeemPromoCode: function () {
            this.send('incrementLoadingItems');
            Parse.Cloud.run('redeemPromoCode', {code: this.get('promoCode'), source: "Web"})
                .then(function (response) {
                    this.set('subscriptionMessage', response);
                    // Update the currentUser.privateData
                    var where = {
                        "objectId": this.get('currentUser.privateData.id')
                    };
                    this.store.findQuery('user-private', {where: JSON.stringify(where)});
                    // Update the currentUser info for SRS
                    var where = {
                        "objectId": this.get('currentUser.id')
                    };
                    this.store.findQuery('parse-user', {where: JSON.stringify(where)});
                    this.transitionToRoute('dashboard.srs');
                    this.send('addNotification', 'srs', "SRS Activated!", '');
                    this.send('decrementLoadingItems');
                }.bind(this), function (error) {
                    this.send('addNotification', 'srs-error', "Error!", error.message);
                    this.set('subscriptionMessage', error.message);
                    setTimeout(function () {
                        this.set('subscriptionMessage', "");
                    }.bind(this), 2500);
                    this.send('decrementLoadingItems');
                }.bind(this));
        }
    }
});
