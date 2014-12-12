import Ember from 'ember';

export default
Ember.Route.extend({
    model: function (params, transition) {
        transition.send('incrementLoadingItems');
        var where = {
            "slug": params.test_slug
        };
        return this.store.findQuery('test', {where: JSON.stringify(where)})
            .then(function (results) {
                if (results.objectAt(0)) {
                    return results.objectAt(0);
                } else {
                    return;
                }
            }.bind(this));
    },
    setupController: function (controller, model, transition) {
        transition.send('decrementLoadingItems');
        if (!model) {
            this.transitionTo('notFound');
            return;
        }
        controller.set('model', model);
        this.send('updatePageTitle', model.get('title'));
        var description = model.get('description');
        if(!description)
            description = "This mcq test on has "+model.get('_data.questions.length')+ " questions! Take it now for free!";
        this.send('updatePageDescription', description);
        Ember.$('head').append('<meta property="og:type" content="mycqs_app:test"/>');
        Ember.$('head').append('<meta property="og:url" content="https://mycqs.com'+this.get('router.url')+'" />');
        Ember.$('head').append('<meta property="og:title" content="'+model.get('title')+'" />');
        Ember.$('head').append('<meta property="og:image" content="'+model.get('author.profileImageURL')+'" />');
        Ember.$('head').append('<meta property="mycqs_app:author" content="'+model.get('author.name')+'" />');
        Ember.$('head').append('<meta property="mycqs_app:questions" content="'+model.get('totalQuestions')+'" />');
        Ember.$('head').append('<meta property="mycqs_app:category" content="'+model.get('category.name')+'" />');
        setTimeout(function () {
            this.send('prerenderReady');
        }.bind(this), 1500);
    }
});
