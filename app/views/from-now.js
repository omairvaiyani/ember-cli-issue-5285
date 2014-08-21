import Ember from 'ember';

export default Ember.View.extend({
    //tagName: 'time',

    template: Ember.Handlebars.compile('{{view.output}}'),

    output: function() {
        var output = moment(this.get('value')).fromNow();
        if(output === "in a few seconds")
            return "just now";
        else
            return output;
    }.property('value'),

    didInsertElement: function() {
        this.tick();
    },

    tick: function() {
        var nextTick = Ember.run.later(this, function() {
            this.notifyPropertyChange('value');
            this.tick();
        }, 3000);
        this.set('nextTick', nextTick);
    },

    willDestroyElement: function() {
        var nextTick = this.get('nextTick');
        Ember.run.cancel(nextTick);
    }

});
