import Ember from 'ember';

export default Ember.Route.extend({
    needs: ['application'],

    prepareWebsiteForOnboarding: function () {
        this.send('hideFooter');
        this.send('minimalNavbar');
    }.on('activate'),

    resetWebsiteAfterOnboarding: function () {
        this.send('showFooter');
        this.send('fullNavbar');
    }.on('deactivate')
});
