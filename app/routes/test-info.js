import Ember from 'ember';
import ParseHelper from '../utils/parse-helper';

export default Ember.Route.extend({

    model: function (params, transition) {
        transition.send('incrementLoadingItems');

        var test = this.store.all('test').filterBy('slug', params.test_slug).objectAt(0);

        if (test && this.checkIfLocalTestHasQuestionsLoaded(test)) {
            return test;
        }

        return ParseHelper.cloudFunction(this, 'getCommunityTest', {slug: params.test_slug})
            .then(function (response) {
                return ParseHelper.extractRawPayload(this.store, 'test', response);
            }.bind(this), function (error) {
                console.dir(error);
                // TODO switch template to 404
            });

    },

    // See TestRoute for info, duplicate code.
    checkIfLocalTestHasQuestionsLoaded: function (test) {
        if (test._data && test._data.questions && test._data.questions[0] && test._data.questions[0]._data
            && test._data.questions[0]._data.stem)
            return true;
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
