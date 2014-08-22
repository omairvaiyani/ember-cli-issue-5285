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
                if(results) {
                    return results.objectAt(0);
                } else {
                    console.log("User not found");
                }
            });
    }
});
