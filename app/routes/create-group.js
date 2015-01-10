import Ember from 'ember';
import CurrentUser from '../mixins/current-user';

export default Ember.Route.extend(CurrentUser, {
    model: function () {
        return this.store.createRecord('group');
    },

    controllerName: 'group.create',

    renderTemplate: function() {
        this.render('group/create');
    },

    setupController: function (controller, model) {
        controller.set('model', model);
        if(this.get('currentUser.course')) {
            controller.set('isForCourse', true);
            controller.set('course', this.get('currentUser.course'));
        }
        if(this.get('currentUser.institution')) {
            controller.set('institution', this.get('currentUser.institution'));
        }
        if(this.get('currentUser.yearNumber')) {
            controller.set('yearOrGrade', this.get('currentUser.yearNumber'));
        }
    },

    actions: {
        willTransition: function () {
            if (!this.controllerFor('createGroup').get('model.id'))
                this.controllerFor('createGroup').get('model').destroyRecord();
        }
    }
});
