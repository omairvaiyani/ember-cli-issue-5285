import Ember from 'ember';
import CurrentUser from '../../mixins/current-user';

export default Ember.Controller.extend(CurrentUser, {
    init: function () {
        //setTimeout(function () {
        this.getKeyPerformanceIndicators();
        //}.bind(this), 1000);
    },

    db: new EmbeddedDashboard(),

    getKeyPerformanceIndicators: function () {
        var promises = [];

        var kpiGroup = new KPIGroupComponent();
        kpiGroup.setDimensions(12, 2);
        kpiGroup.setCaption("24hr Overview");
        var promise = Parse.Cloud.run('adminDashboardAnalytics', {dayLimit: 1})
            .then(function (responseAnalytics) {
            kpiGroup.addKPI('newSignups', {
                caption: 'New Signups',
                value: responseAnalytics.newSignups,
                numberSuffix: ' users'
            });
            kpiGroup.addKPI('testsCreated', {
                caption: 'Tests created',
                value: responseAnalytics.testsCreated,
                numberSuffix: ' tests'
            });
            kpiGroup.addKPI('testsTaken', {
                caption: 'Tests taken',
                value: responseAnalytics.testsTaken,
                numberSuffix: ' tests'
            });
            kpiGroup.addKPI('premiumSubscriptions', {
                caption: 'Premium purchases',
                value: responseAnalytics.premiumSubscriptions,
                numberSuffix: ' users'
            });
            this.get('db').addComponent(kpiGroup);
        }.bind(this));
        promises.push(promise);

        var kpiGroup7Day = new KPIGroupComponent();
        kpiGroup7Day.setDimensions(12, 2);
        kpiGroup7Day.setCaption("7d Overview");
        var promise7day = Parse.Cloud.run('adminDashboardAnalytics', {dayLimit: 7})
            .then(function (responseAnalytics) {
            kpiGroup7Day.addKPI('newSignups', {
                caption: 'New Signups',
                value: responseAnalytics.newSignups,
                numberSuffix: ' users'
            });
            kpiGroup7Day.addKPI('testsCreated', {
                caption: 'Tests created',
                value: responseAnalytics.testsCreated,
                numberSuffix: ' tests'
            });
            kpiGroup7Day.addKPI('testsTaken', {
                caption: 'Tests taken',
                value: responseAnalytics.testsTaken,
                numberSuffix: ' tests'
            });
            kpiGroup7Day.addKPI('premiumSubscriptions', {
                caption: 'Premium purchases',
                value: responseAnalytics.premiumSubscriptions,
                numberSuffix: ' users'
            });
            this.get('db').addComponent(kpiGroup7Day);
        }.bind(this));
        promises.push(promise7day);
        Promise.all(promises).then(function () {
            this.embedDashboard();
        }.bind(this));
    },

    embedDashboard: function () {
        this.get('db').embedTo("admin-dashboard");
    }
});
