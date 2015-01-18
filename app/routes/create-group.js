import Ember from 'ember';
import CurrentUser from '../mixins/current-user';

export default Ember.Route.extend(CurrentUser, {
    model: function () {
        var newGroup = this.store.createRecord('group');
        newGroup.set('educationCohort', this.store.createRecord('education-cohort'));
        return newGroup;
    },

    controllerName: 'group.create',

    renderTemplate: function () {
        this.render('group/create');
    },

    setupController: function (controller, model) {
        controller.set('model', model);
        controller.notifyPropertyChange('currentUser.educationCohort');
    },

    actions: {
        willTransition: function () {
            if (!this.controllerFor('createGroup').get('model.id'))
                this.controllerFor('createGroup').get('model').destroyRecord();
        }
    }
});
