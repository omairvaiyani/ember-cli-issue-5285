import Ember from 'ember';
import ParseHelper from '../utils/parse-helper';

export default Ember.Route.extend({
    model: function (params, transition) {
        if (!this.get('metaTagsSorted'))
            this.sortOutMetaTags(params, transition);

        var where = {
            "slug": params.user_slug
        };
        return this.store.findQuery('parse-user', {
            where: JSON.stringify(where),
            include: 'educationCohort'
        }).then(function (results) {
            if (results.objectAt(0)) {
                var model = results.objectAt(0);
                return model;
            } else {
                this.transitionTo('notFound');
            }
        }.bind(this));
    },

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
                description += " studies "
                if (educationCohort.get('studyField'))
                    description += educationCohort.get('studyField').get('name') + " ";
                if (educationCohort.get('institution'))
                    description += "at " + educationCohort.get('institution').get('name') + " ";
                description += "and ";
            }
            description += "has created " + parseUser.get('numberOfTests') + " tests! ";
            description += "Follow " + parseUser.get('name').split(" ")[0] + " to take their MCQs or" +
            " join MyCQs to create your own tests, for free!";
            transition.send('updatePageDescription', description);
            // FB Open Graph
            Ember.$('head').append('<meta property="og:type" content="profile"/>');
            Ember.$('head').append('<meta property="og:url" content="https://mycqs.com' + this.get('router.url') + '" />');
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
