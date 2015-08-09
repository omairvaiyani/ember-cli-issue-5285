import Ember from 'ember';
import ParseHelper from '../utils/parse-helper';

// Mixin requires CurrentUserMixin in Controller.
export default Ember.Mixin.create({
    actions: {
        alertToDeleteTest: function (test) {
            var confirmation = {
                controller: this,
                callbackAction: "deleteTest",
                positive: "DELETE",
                negative: "CANCEL",
                returnItem: test
            };
            this.send('addNotification', "delete", "Delete " + test.get('title') + "?", "This is permanent!", confirmation);
        },

        /**
         * @Action Delete Test
         *
         * Called from alertToDeleteTest callback.
         *
         * @param {Boolean} deleteConfirmed
         * @param {Object} test
         */
        deleteTest: function (deleteConfirmed, test) {
            if (deleteConfirmed) {
                this.get('currentUser.createdTests').removeObject(test);
                var testPointer = ParseHelper.generatePointer(test, "Test");
                ParseHelper.cloudFunction(this, 'deleteObjects', {className: "Test", objects: [testPointer]})
                    .then(function () {
                        this.send('addNotification', "success", "Test deleted!", test.get('title'));
                        this.send('testDeleted');
                    }.bind(this), function (error) {
                        console.dir(error);
                        this.get('currentUser.createdTests').pushObject(test);
                        this.send('addNotification', "error", "Could not delete test!", test.get('title'));
                    }.bind(this));
            }
        }
    }

});
