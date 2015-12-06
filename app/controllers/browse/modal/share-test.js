import Ember from 'ember';

export default Ember.Controller.extend({
    shareText: function () {
        return "Check out this quiz on Synap! - " +
                this.get('model.title') + " by " +
            this.get('model.author.name');
    }.property('model.webUrl.length', 'model.title.length')
});
