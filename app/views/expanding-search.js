import Ember from 'ember';

export default Ember.View.extend({
    didInsertElement: function () {
        new UISearch(document.getElementById('sb-search'));
    },

    templateName: 'views/expanding-search'
});
