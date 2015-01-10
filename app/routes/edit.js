import Ember from 'ember';
import CurrentUser from '../mixins/current-user';

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
                            this.transitionTo('notFound');
                            return;
                        }
                    } else {
                        this.transitionTo('notFound');
                        return;
                    }
                }.bind(this));
    }

});
