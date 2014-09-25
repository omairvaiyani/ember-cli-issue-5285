import
Ember
from
'ember';

export default
Ember.Component.extend({
    didInsertElement: function () {
        this.set(this.get('icon'), true);
    },

    height: 30,
    width: 30,

    style: function () {
        return "height:" + this.get('height') + "px;width:" + this.get('width') + "px";
    }.property('height', 'width')
});
