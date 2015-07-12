import
Ember
from
'ember';

export default
Ember.Component.extend({
    didInsertElement: function () {
        /*
         * May be dynamic strings such as category names:
         *
         * can only have 1 word for properties. Could also
         * camelcase, but who can be bothered?
         */
        this.set(this.get('icon').toLowerCase().split(" ")[0], true);
    },

    height: 30,
    width: 30,
    margin: 'none',

    colour: "#e73a3d",

    setColour: function () {
        if(this.get('colour') === white) {
            this.set('class', "white-icon");
        }
    }.observes('colour'),

    style: function () {
        return "height:" + this.get('height') + "px;width:" + this.get('width') + "px;margin:"+this.get('margin')+";";
    }.property('height', 'width')
});
