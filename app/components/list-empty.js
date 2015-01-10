import Ember from 'ember';

export default Ember.Component.extend({
    actions: {
        promptAction: function (action) {
            this.get('parentController').send(this.get(action));
        }
    }
});
