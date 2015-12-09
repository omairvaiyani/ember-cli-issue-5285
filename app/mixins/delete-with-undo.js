import Ember from 'ember';
import ParseHelper from '../utils/parse-helper';

// Mixin requires CurrentUserMixin in Controller.
export default Ember.Mixin.create({
    actions: {
        /**
         * @Function Delete Object
         * @param {Object} returnItem
         * { array: {Ember.A}, object: {Ember.O}, title: {string}, message: {string}, type: {string} }
         *
         * Send extra options within returnItem and they will be returned
         * on all callbacks.
         */
        deleteObject: function (returnItem) {

            if (!returnItem.type) {
                returnItem.type = returnItem.object.constructor.modelName ? returnItem.object.constructor.modelName :
                    returnItem.object.constructor.typeKey; // Model name in newer ember.data versions.
            }

            this.send('preObjectDelete', returnItem);

            returnItem.array.removeObject(returnItem.object);
            // Timeout allows thread to be free for UX animation
            setTimeout(function () {
                var undo = {
                        controller: this,
                        callbackAction: "deleteObjectCallback",
                        returnItem: returnItem
                    },
                    notification = {
                        type: "delete",
                        title: returnItem.title,
                        message: returnItem.message,
                        undo: undo
                    };
                this.send('addNotification', notification);
            }.bind(this), 400);
        },

        /**
         * @Action Delete Object Callback
         *
         * Called from notification
         *
         * @param {Boolean} mindChanged
         * @param {Object} returnItem
         */
        deleteObjectCallback: function (mindChanged, returnItem) {
            if (!mindChanged) {
                // Continue object deletion
                var objectPointer = ParseHelper.generatePointer(returnItem.object, returnItem.type.capitalize());
                ParseHelper.cloudFunction(this, 'deleteObjects', {
                    className: returnItem.type.capitalize(),
                    objects: [objectPointer]
                }).then(function () {
                    // All done, as far as the user is concerned, nothing new has happened.
                    this.send('postObjectDelete', returnItem);
                }.bind(this), function (error) {
                    console.dir(error);
                    returnItem.array.pushObject(returnItem.object);
                    this.send('undoObjectDelete', returnItem, error);

                    this.send('addNotification',
                        {type: "error", title: "Error whilst trying to delete!", message: error.message});

                }.bind(this));
            } else {
                // Undo changes
                this.send('addNotification',
                    {
                        type: "undo",
                        title: returnItem.type.capitalize() + " no longer deleted.",
                        message: "Phewww right?"
                    });

                setTimeout(function () {
                    // Allow thread to clear after UX animation
                    returnItem.array.pushObject(returnItem.object);
                    this.send('undoObjectDelete', returnItem);
                }.bind(this), 300);

            }
        },

        preObjectDelete: function (returnItem) {
            // Called before object is deleted, override in controller at will
        },

        postObjectDelete: function (returnItem) {
            // Called after object is deleted, override in controller at will
        },

        undoObjectDelete: function (returnItem, error) {
            // Called if object delete is undo'd, override in controller at will
        }
    }

});
