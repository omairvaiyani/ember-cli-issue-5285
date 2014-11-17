import Ember from 'ember';

export default Ember.Route.extend({
    model: function (params, transition) {
        var slug = params.category_slug.toLowerCase();
        switch (slug) {
            case "medical":
                slug = "medicine";
                break;
        }
        transition.send('updateStatusCode', "301");
        this.transitionTo('category', slug);
    }
});
