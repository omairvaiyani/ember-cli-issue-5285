import Ember from 'ember';

export default Ember.Component.extend({
    tagName: 'button',
    textState: 'default',
    reset: false,
    classNames: ['async-button'],
    classNameBindings: ['textState'],
    attributeBindings: ['disabled', 'type'],

    type: 'submit',
    disabled: Ember.computed.equal('textState', 'pending'),

    click: function () {
        var _this = this;
        this.set('textState', 'pending');
        this.sendAction('action', function (promise) {
            if (promise)
                _this.set('promise', promise);
            else {
                _this.set('textState', 'rejected');
            }
        }, this.get('param1'), this.get('param2'));

        // If this is part of a form, it will perform an HTML form
        // submission
        return false;
    },

    text: function () {
        return this.getWithDefault(this.textState, this.get('default'));
    }.property('textState', 'default', 'pending', 'resolved', 'fulfilled', 'rejected'),

    resetObserver: Ember.observer('textState', 'reset', function () {
        if (this.get('reset') && ['resolved', 'rejected', 'fulfilled'].contains(this.get('textState'))) {
            setTimeout(function () {
                if(this && this.get('textState'))
                    this.set('textState', 'default');
            }.bind(this), 1500);
        }
    }),

    handleActionPromise: Ember.observer('promise', function () {
        var _this = this;
        this.get('promise').then(function () {
            if (!_this.isDestroyed) {
                _this.set('textState', 'fulfilled');
            }
        }, function () {
            if (!_this.isDestroyed) {
                _this.set('textState', 'rejected');
            }
        });
    }),

    setUnknownProperty: function (key, value) {
        if (key === 'resolved') {
            Ember.deprecate("The 'resolved' property is deprecated. Please use 'fulfilled'", false);
            key = 'fulfilled';
        }

        this[key] = null;
        this.set(key, value);
    }
});
