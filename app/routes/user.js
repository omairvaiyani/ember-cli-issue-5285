import
Ember
from
'ember';

export default
Ember.Route.extend({
    model: function (params) {
        var where = {
            "slug": params.user_slug
        };
        return this.store.findQuery('parse-user', {where: JSON.stringify(where)})
            .then(function (results) {
                if (results.objectAt(0)) {
                    return results.objectAt(0);
                } else {
                    this.transitionTo('notFound');
                }
            }.bind(this));
    },

    actions: {
        willTransition: function (transition) {
            var controller = this.controllerFor('user');
            console.log("Has been dirtied? "+controller.get('isEditModeDirtied'));
            if (controller.get('isEditMode') &&
                //controller.get('isEditModeDirtied') &&
                !confirm("Are you sure you want to abandon changes?")) {
                transition.abort();
                return false;
            } else {
                controller.send('cancelEditMode', false);
                return true;
            }
        }
    }
});
