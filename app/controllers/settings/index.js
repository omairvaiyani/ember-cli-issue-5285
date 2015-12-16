import Ember from 'ember';
import CurrentUser from '../../mixins/current-user';

export default Ember.Controller.extend(CurrentUser, {
    actions: {
        saveChanges: function (callback) {
            var promise = this.get('currentUser').save().then(function () {
                this.send('savedNotification');
            }.bind(this), function (error) {
                this.send('errorNotification', error);
                return new Parse.Promise.rejected(error);
            }.bind(this));

            if (callback)
                callback(promise);
        },

        savedNotification: function () {
            var notification = {
                type: "saved",
                title: "Changes Saved!"
            };

            this.send('addNotification', notification);
            window.scrollTo(0, 0);
        },

        errorNotification: function (error) {
            var message = error.error;
            if (error.code === 203)
                message = "Email (" + this.get('currentUser.email') + ") already taken!";
            var notification = {
                type: "error",
                title: "Error!",
                message: message
            };
            this.send('addNotification', notification);
        }
    }
});
