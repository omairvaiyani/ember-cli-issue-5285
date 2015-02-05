import Ember from 'ember';

export default Ember.Route.extend({
    notFound: false,

    model: function (params) {
        var where = {
            slug: params.group_slug
        };
        return this.store.findQuery('group', {where: JSON.stringify(where)})
            .then(function (groups) {
                if (groups.objectAt(0))
                    return groups.objectAt(0);
                else
                    this.set('notFound', true);
            }.bind(this));
    },
    setupController: function (controller, model) {
        if (this.get('notFound')) {
            this.send('updateStatusCode', 404);
            return;
        }
        controller.set('model', model);
        model.getMembers(this.store);
        model.getGroupTests(this.store);
        model.getGatheredTests(this.store);
        this.send('updatePageTitle', model.get('name'));
        var description = "Join " + model.get('numberOfMembers') + " members who have shared "
            + model.get('numberOfTests') + " mcq tests in this MyCQs Group! Or use our free test maker" +
            " to create quizzes!";
        this.send('updatePageDescription', description);
        if (model.get('educationCohort.id.length') && !model.get('educationCohort.isFulfilled')) {
            var promises = [];
            model.get('educationCohort')
                .then(function (educationCohort) {
                    promises.push(educationCohort.get('institution'));
                    promises.push(educationCohort.get('studyField'));
                    return Promise.all(promises);
                }).then(function() {
                   var description = "A group for "+model.get('educationCohort.currentYear')  +
                       " " + model.get('educationCohort.studyField.name') + " at " +
                           model.get('educationCohort.institution.name') + ". Join to take "+model.get('numberOfTests') +
                           ' mcq tests shared by '+model.get('numberOfMembers')+" members!";
                    this.send('updatePageDescription', description);
                    this.send('prerenderReady');
                }.bind(this));
        } else
            this.send('prerenderReady');
    },
    /*
     * Instead of transitioning to Route.notFound
     * Trying this method of rendering a 404 template.
     *
     * Advantage: No rerouting loops, better history location.
     *
     * Disadvantage: Unsure if renderTemplate will be called
     * at the correct time.. i.e. after model is loaded and
     * every time model changes.
     */
    renderTemplate: function () {
        if (this.get('notFound')) {
            this.render('fourOhFour');
        } else {
            this.render('group');
        }
    }
});
