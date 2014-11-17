import Ember from 'ember';

export default Ember.Component.extend({
    output: function() {
        var output = "";
        if(this.get('prefix'))
            output = this.get('prefix');

        output += moment(this.get('time')).fromNow();

        if(output === "in a few seconds" && !this.get('prefix'))
            output += "just now";

        if(this.get('suffix'))
            output += this.get('suffix');

        return output;
    }.property('time'),

    didInsertElement: function() {
        this.tick();
    },

    tick: function() {
        var nextTick = Ember.run.later(this, function() {
            this.notifyPropertyChange('time');
            this.tick();
        }, 3000);
        this.set('nextTick', nextTick);
    },

    willDestroyElement: function() {
        var nextTick = this.get('nextTick');
        Ember.run.cancel(nextTick);
    }
});
