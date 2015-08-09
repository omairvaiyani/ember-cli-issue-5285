import Ember from 'ember';

export default Ember.View.extend({
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
    hideAfterMs: 6500,//6500 normally

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


        var topPx = row * unitHeight,
            rightPx = column * unitWidth;

        if (!this.get('isOpaque') || !this.get('easeIn')) {
            // This timeout allows the initial position of the element to be set.
            // Afterward, the new position will be set by the code below,
            // thus the CSS transition animation can take place.
            setTimeout(function () {
                if (this.get('isOpaque'))
                    this.set('easeIn', true);
            }.bind(this), 10);

            // Initial element position.
            return "top: " + topPx + "px;";
        }

        return 'top: ' + topPx + 'px; right: ' + rightPx + 'px;';
    }.property('controller.notifications.@each.closed', 'easeIn', 'isOpaque'),

    /**
     * @property {String} fontawesome class for the icon
     */
    iconType: function () {
        var type = this.get('content.type'),
            hash = {
                'welcome': 'fa-bullhorn',
                'profile': 'fa-user',
                'saved': 'fa-floppy-o',
                'save': 'fa-floppy-o',
                'deleted': 'fa-trash-o',
                'delete': 'fa-trash-o',
                'trash': 'fa-trash-o',
                'success': 'fa-check-square-o',
                'warning': 'fa-exclamation',
                'unsavedChanges': 'fa-exclamation',
                'error': 'fa-exclamation',
                'alert': 'fa-exclamation',
                'facebook': 'fa-facebook',
                'create': 'fa-pencil-square-o',
                'srs': 'srs',
                'srs-error': 'srs-error',
                'points': 'fa-gamepad'
            };
        return hash[type] || '';
    }.property('content.type'),

    isSRSNotification: function () {
        return this.get('iconType') === "srs" || this.get('iconType') === "srs-error";
    }.property('iconType.length'),

    /**
     * @property notificationWarning
     * @returns {boolean}
     * If true notification will
     * look red.
     */
    notificationWarning: function () {
        switch (this.get('content.type')) {
            case 'unsavedChanges':
            case 'deleted':
            case 'delete':
            case 'trash':
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
            if (this.get('content.confirm') && !this.get('content.confirm.responded')) {
                this.send('confirmCallback', false);
                return;
            }

            this.set('isOpaque', false);
            setTimeout(function () {
                this.set('content.closed', true);
                clearTimeout(this.get('timeoutId'));
            }.bind(this), 450);
        },

        confirmCallback: function (isPositive) {
            // Begin dismissing the notification first
            // This allows the UX thread to work without load.
            this.set('content.confirm.responded', true);
            this.send('close');

            setTimeout(function () {
                // Begin confirmation action on given controller.
                this.get('content.confirm.controller').send(this.get('content.confirm.callbackAction'), isPositive,
                    this.get('content.confirm.returnItem'));
            }.bind(this), 350);
        }
    }
});
