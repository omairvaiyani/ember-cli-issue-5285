import
Ember
from
'ember';

export default
Ember.Route.extend({
    model: function (params) {
        var where = {
            "slug": params.user_slug
        };
        return this.store.findQuery('parse-user', {where: JSON.stringify(where)})
            .then(function (results) {
                if (results.objectAt(0)) {
                    return results.objectAt(0);
                } else {
                    this.transitionTo('notFound');
                }
            }.bind(this));
    },

    isTransitionAborted: false,
    previousTransition: null,
    actions: {
        /*
         * Automatically fires on transition attempt.
         * If UserController.isEditMode === true
         * and the user has made changes, prevent
         * transition and ask for confirmation.
         *
         * If user closes the confirmation notification
         * or presses 'Discard changes', then
         * disable edit mode, null the changes
         * and continue with the stored 'previousTransition'.
         *
         * NOTE: Ember.js bug with this method is
         * causing double-fire for .willTransition,
         * hence the first 'if' block and 'isTransitionAborted'
         * object.
         */
        willTransition: function (transition) {
            if (this.get('isTransitionAborted')) {
                this.set('isTransitionAborted', false);
                transition.abort();
                return false;
            }
            var controller = this.controllerFor('user');
            if (controller.get('isEditMode') &&
                controller.get('isEditModeDirtied')) {
                var confirm = {
                    "controller": controller,
                    "negative": "Discard and continue",
                    "positive": "Stay here",
                    "callbackAction": "unsavedChangesCallback"
                };
                this.send('addNotification', 'unsavedChanges', 'Unsaved profile changes!',
                    '', confirm);
                this.set('isTransitionAborted', true);
                this.set('previousTransition', transition);
                transition.abort();
                return false;
            } else {
                controller.send('cancelEditMode', false);
                return true;
            }
        },

        unsavedChangesCallback: function (isPositive) {
            var controller = this.controllerFor('user'),
                previousTransition = this.get('previousTransition');
            if (isPositive) {
                /*
                 * The user wants to stay and make changes to their profile
                 */
                this.set('previousTransition', null);
            } else {
                /*
                 * User wants to discard their changes and continue
                 * transitioning to a different page.
                 */
                controller.send('cancelEditMode');
                if (previousTransition) {
                    previousTransition.retry();
                    this.set('previousTransition', null);
                }
            }
        }
    }
});
