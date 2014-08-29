import
Ember
from
'ember';

import
CurrentUser
from
'../../../mixins/current-user';

import
EachItem
from
'../../../mixins/each-item';

export default
Ember.ObjectController.extend(CurrentUser, EachItem, {
    latestAttempt: function () {
        if (!this.get('isCurrentUsersTest'))
            return;

        var latestAttempt;
        this.get('currentUser.latestAttempts').forEach(function (attempt) {
            if (attempt.get('_data.test.id') === this.get('model.id')) {
                latestAttempt = attempt;
                return;
            }
        }.bind(this));

        return latestAttempt;
    }.property('isCurrentUsersTest'),

    isCurrentUsersTest: function () {
        return this.get('currentUser.id') === this.get('model._data.author.id');
    }.property('currentUser.id'),

    array: function () {
        this.propertyDidChange('isCurrentUsersTest');
        return this.get('parentController.tests');
    }.property('parentController.tests.length')


});
