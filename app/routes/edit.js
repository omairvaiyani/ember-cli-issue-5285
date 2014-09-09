import
Ember
from
'ember';

import
CurrentUser
from
'../mixins/current-user';

export default
Ember.Route.extend(CurrentUser, {
    controllerName: 'create',

    model: function (params) {
        var model,
            where = {
                'slug': params.test_slug
            };
        return this.store.findQuery('test', {where: JSON.stringify(where)})
            .then(
                function (results) {
                    if(results.objectAt(0)) {
                        model = results.objectAt(0);
                        if (model.get('_data.author.id') === this.get('currentUser.id'))
                            return model;
                        else {
                            alert("You are not authorised to edit this test.");
                            this.transitionTo('index');
                            return {};
                        }
                    } else {
                        alert("Test not found!");
                        this.transitionTo('index');
                        return {};
                    }
                }.bind(this));
    }

});
