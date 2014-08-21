import
Ember
from
'ember';

export default
Ember.Route.extend({
    beforeModel: function () {
        if (!this.get('currentUser'))
            this.transitionTo('index');
    },
    model: function (params) {
        var user = this.get('currentUser');
        var model;
        return this.store.find('test', params.test_id).then(
                function (test) {
                    model = test;
                    return test.get('author');
                }.bind(this)).then(function (author) {

                if (author.get('id') === user.get('id'))
                    return model;
                else {
                    this.transitionTo('index');
                    return {};
                }
            });
    },
    controllerName: 'create',
    setupController: function (controller, model) {
        controller.set('model', model);
    }
});
