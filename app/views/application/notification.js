import
    Ember
    from
        'ember';

export default
    Ember.View.extend({
        templateName: 'views/notification',

        classNameBindings: [
            ':notification',
            'notificationWarning',
            'content.closed',
            'isOpaque'
        ],

        attributeBindings: ['style'],

        /**
         * @property {Number} Will be set by `didInsertElement`.
         * Used for clearing the auto-hide timeout
         */
        timeoutId: null,

        /**
         * Lifecycle hook - called when view is created.
         * Note: this is a private method in ember, so make sure to
         * call `this._super()` before doing anything.
         */
        init: function () {
            this._super();
            var fn = function () {
                this.notifyPropertyChange('style');
            }.bind(this);
            this.set('_recomputeStyle', fn);
            $(window).bind('resize', fn);
        },

        /**
         * Lifecycle hook - called right before view is destroyed
         */
        willDestroyElement: function () {
            $(window).unbind('resize', this.get('_recomputeStyle'));
        },

        /**
         * View lifecycle hook - called when the view enters the DOM
         */
        didInsertElement: function () {
            // If this notification does not require explicit
            // confirmation, autohide after a bit.
            if (!this.get('content.confirm')) {
                // Be prepared to auto-hide the notification
                this.set('timeoutId', setTimeout(function () {
                    this.send('close');
                }.bind(this), this.get('hideAfterMs')));
            }
            // Fade in the view.
            Ember.run.later(this, function () {
                this.set('isOpaque', true);
            }, 1);
        },

        /**
         * @property {Boolean} should the view be opaque now?
         * Used for fancy fading purposes.
         */
        isOpaque: false,

        /**
         * @property {Number} View will be hidden after this
         * many milliseconds
         */
        hideAfterMs: 6500,

        /**
         * @property {String} The extra styling necessary for placement
         * within the notification container
         */
        style: function () {
            // Get all open notifications
            var notifications = this.get('controller.notifications').rejectBy('closed'),
                index = notifications.indexOf(this.get('content')), // content is the notification object
                viewportHeight = $(window).height(),
                unitHeight = 80,
                unitWidth = 320,
                unitsPerColumn = Math.floor(viewportHeight / unitHeight),
                column = Math.floor(index / unitsPerColumn),
                row = index % unitsPerColumn;

            if (index === -1) {
                // Wasn't in the list, don't care.
                return '';
            }

            var topPx = row * unitHeight,
                rightPx = column * unitWidth;

            return 'top: ' + topPx + 'px; right: ' + rightPx + 'px;';
        }.property('controller.notifications.@each.closed'),

        /**
         * @property {String} fontawesome class for the icon
         */
        iconType: function () {
            var type = this.get('content.type'),
                hash = {
                    'welcome': 'glyphicon glyphicon-bullhorn',
                    'profile': 'glyphicon glyphicon-user',
                    'saved': 'glyphicon-floppy-saved',
                    'deleted': 'glyphicon-trash',
                    'unsavedChanges': 'glyphicon-warning-sign',
                    'warning': 'glyphicon-warning-sign',
                    'error': 'glyphicon-error-sign',
                    'facebook': 'fa fa-facebook',
                    'create': 'glyphicon-pencil',
                    'srs': 'srs',
                    'srs-error': 'srs-error'
                };
            return hash[type] || '';
        }.property('content.type'),

        isSRSNotification: function () {
            if (this.get('iconType') === "srs" || this.get('iconType') === "srs-error")
                return true;
            else
                return false;
        }.property('iconType.length'),

        /**
         * @property notificationWarning
         * @returns {Bool}
         * If true notification will
         * look red.
         */
        notificationWarning: function () {
            switch (this.get('content.type')) {
                case 'unsavedChanges':
                case 'deleted':
                case 'warning':
                case 'srs-error':
                case 'premium-error':
                case "error":
                case "alert":
                    return true;
                    break;
                default:
                    return false;
                    break;
            }
        }.property('content.type'),

        actions: {
            /**
             * Action handler - "close" the notification
             */
            close: function () {
                this.set('isOpaque', false);
                setTimeout(function () {
                    this.set('content.closed', true);
                    clearTimeout(this.get('timeoutId'));
                    if (this.get('content.confirm')) {
                        this.get('content.confirm.controller').send(this.get('content.confirm.callbackAction'), false);
                    }
                }.bind(this), 300);
            },

            confirmCallback: function (isPositive) {
                this.get('content.confirm.controller').send(this.get('content.confirm.callbackAction'), isPositive,
                    this.get('content.confirm.returnItem'));
                this.set('content.confirm', null);
                this.send('close');
            }
        }
    });
