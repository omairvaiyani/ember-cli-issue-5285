import Ember from 'ember';
import CurrentUser from '../mixins/current-user';

export default Ember.Controller.extend(CurrentUser, {
    actions: {
        saveChanges: function (callback) {
            var promise = this.get('currentUser').save().then(function () {
                var notification = {
                    type: "saved",
                    title: "Changes Saved!"
                };

                this.send('addNotification', notification);
                window.scrollTo(0, 0)
            }.bind(this), function (error) {
                var notification = {
                    type: "error",
                    title: "Error!",
                    message: error.error
                };
                this.send('addNotification', notification);
            }.bind(this));

            if(callback)
                callback(promise);
        }
    }
});
