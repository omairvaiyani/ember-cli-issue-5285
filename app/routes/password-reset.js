import
Ember
from
'ember';

export default
Ember.Route.extend({
    objectId: null,

    model: function (params) {
        this.set('objectId', params.password_reset_id);
        return {};
    },

    setupController: function (controller) {
        if (controller.get('passwordResetComplete')) {
            this.transitionTo('notFound');
            return;
        }

        Parse.Cloud.run('validatePasswordResetRequest', {objectId: this.get('objectId')})
            .then(
            function (parseNativeUser) {
                console.dir(parseNativeUser);
                return this.store.find('parse-user', parseNativeUser.id);
            }.bind(this),
            function (error) {
                this.transitionTo('notFound');
                return;
            }.bind(this)
        ).then(function (user) {
                controller.set('model', user);
                controller.set('passwordResetId', this.get('objectId'));
            }.bind(this));
    }
});
