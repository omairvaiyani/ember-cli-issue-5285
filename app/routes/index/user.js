import Ember from 'ember';
import ParseHelper from '../../utils/parse-helper';
import RouteHistory from '../../mixins/route-history';

export default Ember.Route.extend(RouteHistory, {

    model: function (params) {

        // TODO sort out meta tags
        //if (!this.get('metaTagsSorted'))
        //    this.sortOutMetaTags(params, transition);

        var user = this.store.all('parse-user').filterBy('slug', params.user_slug).objectAt(0);
        // Only use local record if user's tests have been fetched.
        // Annoyingly, ember-data is screwing up stored records,
        // it's adding createdTests to the wrong users. Here's a workaround.
        if (user && user.get('createdTests.length')
            && user.get('createdTests').objectAt(0).get('author.id') === user.get('id')) {
            return user;
        }

        return ParseHelper.cloudFunction(this, 'getUserProfile', {
                slug: params.user_slug,
                includeTests: true
            })
            .then(function (response) {
                var createdTests = new Ember.A(),
                    savedTests = new Ember.A();

                if (response.createdTests)
                    createdTests.addObjects(ParseHelper.extractRawPayload(
                        this.store, 'test', _.clone(response.createdTests)));

                if (response.savedTests)
                    savedTests.addObjects(ParseHelper.extractRawPayload(
                        this.store, 'test', _.clone(response.savedTests)));

                var user = ParseHelper.extractRawPayload(this.store, 'parse-user', response);

                user.set('createdTests', createdTests);
                user.set('savedTests', savedTests);

                return user;
            }.bind(this), function (error) {
                console.dir(error);
                // TODO switch template to 404
            });
    },

    setupController: function (controller, model, transition) {
        controller.set('model', model);

        // Send Route to RouteHistory
        if (model) {
            var routePath = "index.user",
                routeLabel;
            if(controller.get('isCurrentUser')) {
                routeLabel = "My Study";
            } else  {
                routeLabel = model.get('firstName') + "'s Quizzes";
            }
            transition.send('addRouteToHistory', routePath, routeLabel, transition, 'user_slug');
        }
    },


    // Currently not used, see model hook
    sortOutMetaTags: function (params, transition) {
        // Sort out Meta Tags and FB Graph for crawlers
        // User Parse.Query to utilise .include
        var query = new Parse.Query(Parse.User);
        query.include(['educationCohort.studyField', 'educationCohort.institution']);
        query.equalTo('slug', params.user_slug);
        query.find().then(function (results) {
            var parseUser = results[0];
            if (!parseUser)
                return;
            var educationCohort = parseUser.get('educationCohort');
            // Meta Description
            var description = parseUser.get('name') + " ";
            if (educationCohort) {
                description += " studies ";
                if (educationCohort.get('studyField'))
                    description += educationCohort.get('studyField').get('name') + " ";
                if (educationCohort.get('institution'))
                    description += "at " + educationCohort.get('institution').get('name') + " ";
                description += "and ";
            }
            description += "has created " + parseUser.get('numberOfTests') + " tests! ";
            description += "Follow " + parseUser.get('name').split(" ")[0] + " to take their MCQs or" +
                " join Synap to create your own tests, for free!";
            transition.send('updatePageDescription', description);
            // FB Open Graph
            Ember.$('head').append('<meta property="og:type" content="profile"/>');
            Ember.$('head').append('<meta property="og:url" content="https://synap.ac' + this.get('router.url') + '" />');
            Ember.$('head').append('<meta property="og:title" content="' + parseUser.get('name') + '" />');
            Ember.$('head').append('<meta property="og:image" content="' +
                ParseHelper.getUserProfileImageUrl(parseUser) + '" />');
            Ember.$('head').append('<meta property="og:first_name" content="' + parseUser.get('name').split(" ")[0] + '" />');
            if (parseUser.get('name').split(" ").length > 1)
                Ember.$('head').append('<meta property="og:last_name" content="' + parseUser.get('name').split(" ")[1] + '" />');
            if (parseUser.get('fbid'))
                Ember.$('head').append('<meta property="og:profile_id" content="' + parseUser.get('fbid') + '" />');
            if (educationCohort) {
                if (educationCohort.get('studyField'))
                    Ember.$('head').append('<meta property="og:study_field" content="'
                        + educationCohort.get('studyField').get('name') + '" />');
                if (educationCohort.get('institution'))
                    Ember.$('head').append('<meta property="og:institution" content="'
                        + educationCohort.get('institution').get('name') + '" />');
                Ember.$('head').append('<meta property="og:current_year" content="'
                    + educationCohort.get('currentYear') + '" />');
            }
            // Ready for crawling
            transition.send('prerenderReady');
            this.set('metaTagsSorted', true);
        }.bind(this));
    },

    isTransitionAborted: false,
    previousTransition: null,
    actions: {

        /*
         * Automatically fires on transition attempt.
         * If UserController.isEditMode === true
         * and the user has made changes, prevent
         * transition and ask for confirmation.
         *
         * If user closes the confirmation notification
         * or presses 'Discard changes', then
         * disable edit mode, null the changes
         * and continue with the stored 'previousTransition'.
         *
         * NOTE: Ember.js bug with this method is
         * causing double-fire for .willTransition,
         * hence the first 'if' block and 'isTransitionAborted'
         * object.
         */
        willTransition: function (transition) {
            if (this.get('isTransitionAborted')) {
                this.set('isTransitionAborted', false);
                transition.abort();
                return false;
            }
            var controller = this.controllerFor('user');
            if (controller.get('isEditMode') &&
                controller.get('isEditModeDirtied')) {
                var confirm = {
                    "controller": controller,
                    "negative": "Discard and continue",
                    "positive": "Stay here",
                    "callbackAction": "unsavedChangesCallback"
                };
                this.send('addNotification', 'unsavedChanges', 'Unsaved profile changes!',
                    '', confirm);
                this.set('isTransitionAborted', true);
                this.set('previousTransition', transition);
                transition.abort();
                return false;
            } else {
                controller.send('cancelEditMode', false);
                return true;
            }
        },

        unsavedChangesCallback: function (isPositive) {
            var controller = this.controllerFor('user'),
                previousTransition = this.get('previousTransition');
            if (isPositive) {
                /*
                 * The user wants to stay and make changes to their profile
                 */
                this.set('previousTransition', null);
            } else {
                /*
                 * User wants to discard their changes and continue
                 * transitioning to a different page.
                 */
                controller.send('cancelEditMode');
                if (previousTransition) {
                    previousTransition.retry();
                    this.set('previousTransition', null);
                }
            }
        }
    }
});
