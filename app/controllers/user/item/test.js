import
Ember
from
'ember';

import
EachItem
from
'../../../mixins/each-item';

export default
Ember.ObjectController.extend(EachItem, {
    needs: 'user',

    latestAttempt: function () {
        var latestAttemptsReceived = this.get('controllers.user.latestAttemptsReceived'),
            latestAttempts = this.get('controllers.user.latestAttempts'),
            latestAttempt;
        if(!latestAttemptsReceived)
            return;

        latestAttempts.forEach(function(attempt) {
            if(attempt.get('_data.test.id') === this.get('model.id'))
                latestAttempt = attempt;
        }.bind(this));
        if(latestAttempt) {
            console.log("Found latest attempt");
            console.dir(latestAttempt);
        }
        return latestAttempt;
    }.property('controllers.user.latestAttemptsReceived'),

    array: function () {
        return this.get('parentController.tests');
    }.property('parentController.tests.length')


});
