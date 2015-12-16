import Ember from 'ember';
import CurrentUser from '../mixins/current-user';

export default Ember.Controller.extend(CurrentUser, {
    init: function () {
        // Save any prior changes, so that if we have to 'rollback'
        // changes here, we don't overshoot.
        if (this.get('currentUser.isDirty'))
            this.get('currentUser').save();
    },

    actions: {

        /**
         * @Action Discard and Continue
         *
         * Notification Confirmation callback.
         *
         * See SettingsRoute.actions.willTransition
         *
         * If user chooses discard, we rollback
         * changes and continue with transition.
         * Else, nothing happens and they stay
         * on this route
         *
         * @param isPositive
         * @param transition
         */
        discardAndContinue: function (isPositive, transition) {
            this.set('transitionInLimbo', false);
            if(isPositive) {
                this.get('currentUser').rollback();

                var notification = {
                    type: "warning",
                    title: "Changes Reverted!"
                };
                this.send('addNotification', notification);

                var currentUser = this.get('currentUser');
                transition.retry();
            }
        }
    }
});
