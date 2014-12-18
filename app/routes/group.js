import Ember from 'ember';

export default Ember.Route.extend({
    notFound: false,

    model: function (params) {
        var where = {
            slug: params.group_slug
        };
        return this.store.findQuery('group', {where: JSON.stringify(where)})
            .then(function (groups) {
                if(groups.objectAt(0))
                    return groups.objectAt(0);
                else
                    this.set('notFound', true);
            }.bind(this));
    },
    /*
     * Instead of transitioning to Route.notFound
     * Trying this method of rendering a 404 template.
     *
     * Advantage: No rerouting loops, better history location.
     *
     * Disadvantage: Unsure if renderTemplate will be called
     * at the correct time.. i.e. after model is loaded and
     * every time model changes.
     */
    renderTemplate: function() {
        if(this.get('notFound')) {
            this.render('fourOhFour');
        } else {
            this.render('group');
        }
    }
});
