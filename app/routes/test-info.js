import Ember from 'ember';
import ParseHelper from '../utils/parse-helper';

export default Ember.Route.extend({
    model: function (params, transition) {
        // TODO undo commented code and figure out error
        //if (!this.get('metaTagsSorted'))
          //  this.sortOutMetaTags(params, transition);

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
    },

    sortOutMetaTags: function (params, transition) {
        // Sort out Meta Tags and FB Graph for crawlers
        // User Parse.Query to utilise .include
        var query = new Parse.Query("Test");
        query.include(['author', 'category']);
        query.equalTo('slug', params.test_slug);
        query.find().then(function (results) {
            var parseTest = results[0];
            if (!parseTest)
                return;
            transition.send('updatePageTitle', parseTest.get('title') + " - MyCQs");
            var description = parseTest.get('description');
            if (!description)
                description = "This mcq test on " + parseTest.get('category').get('name') + " has " +
                parseTest.get('questions').length + " questions! Take it now for free!";
            transition.send('updatePageDescription', description);

            Ember.$('head').append('<meta property="og:type" content="mycqs_app:test"/>');
            Ember.$('head').append('<meta property="og:url" content="https://mycqs.com' + this.get('router.url') + '" />');
            Ember.$('head').append('<meta property="og:title" content="' + parseTest.get('title') + '" />');
            Ember.$('head').append('<meta property="og:image" content="' +
            ParseHelper.getUserProfileImageUrl(parseTest.get('author')) + '" />');
            Ember.$('head').append('<meta property="mycqs_app:author" ' +
            'content="https://mycqs.com/' + parseTest.get('author').get('slug') + '" />');
            Ember.$('head').append('<meta property="mycqs_app:questions" content="' + parseTest.get('questions').length + '" />');
            Ember.$('head').append('<meta property="mycqs_app:category" content="' + parseTest.get('category').get('name') + '" />');

            // Ready for crawling
            transition.send('prerenderReady');
            this.set('metaTagsSorted', true);
        }.bind(this));
    }

});
