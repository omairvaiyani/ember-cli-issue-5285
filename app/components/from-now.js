import Ember from 'ember';

export default Ember.Component.extend({
    classNames: ['inline-block', 'time-ago'],

    simpleDate: function () {
        return moment(this.get('time')).format("MMM Do [at] h:mm a");
    }.property('time'),

    output: function() {
        var output = "";
        if(this.get('prefix'))
            output = this.get('prefix');

        output += moment(this.get('time')).fromNow();

        if(output === "in a few seconds" && !this.get('prefix'))
            output += "just now";

        if(this.get('suffix'))
            output += this.get('suffix');

        if(this.get('mini')) {
            output = output.replace("a few seconds ago", "now");
            output = output.replace("a minute ago", "1m");
            output = output.replace(" minutes ago", "m");
            output = output.replace("an hour ago", "1h");
            output = output.replace(" hours ago", "h");
            output = output.replace("a day ago", "1d");
            output = output.replace(" days ago", "d");
            output = output.replace("a week ago", "1w");
            output = output.replace(" weeks ago", "w");
            output = output.replace("a month ago", "1mo");
            output = output.replace(" months ago", "mo");
            output = output.replace("a year ago", "1y");
            output = output.replace(" years ago", "y");
        }

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
