import Ember from 'ember';

export default Ember.Route.extend({
    actions: {
        /**
         * @Override Will Transition
         *
         * For both SettingsIndex and
         * SettingsStudy Controllers.
         *
         * If user tries to leave with
         * unsaved changes, this hook
         * will abort the transition
         * and create a confirmation
         * notification.
         *
         * Callback is in SettingsController.
         *
         * @param transition
         * @returns {*}
         */

        willTransition: function (transition) {
            if(this.controller.get('transitionInLimbo'))
                return transition.abort();

            if(this.controller.get('currentUser.isDirty')) {
                var notification = {
                    type: "unsaved",
                    title: "Unsaved Changes!",
                    message: "Discard Changes?",
                    confirm: {
                        controller: this.controller,
                        callbackAction: "discardAndContinue",
                        positive: "Discard",
                        negative: "Stay",
                        returnItem: transition
                    }
                };
                this.send('addNotification', notification);

                this.controller.set('transitionInLimbo', true);
                transition.abort();
                return false;
            } else {
                return true;
            }
        }
    }
});
