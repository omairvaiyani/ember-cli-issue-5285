import Ember from 'ember';
import CurrentUser from '../mixins/current-user';

export default Ember.Controller.extend(CurrentUser, {
    needs: ['create'],
    /*
     * Join process
     */
    joinStep: {
        create: {
            active: false,
            disabled: false,
            completed: false
        },
        join: {
            active: false,
            disabled: true,
            completed: false
        },
        personalise: {
            active: false,
            disabled: true,
            completed: false
        },
        features: {
            active: false,
            disabled: true,
            completed: false
        },
        addQuestions: {
            active: false,
            disabled: true,
            completed: false
        },
        completed: false
    },

    actions: {
        goToJoinStep: function (step) {
            if(step === 'create' || step === 'addQuestions') {
                this.get('controllers.create').send('goToJoinStep', step);
                return;
            }
            this.set('joinStep.create.active', false);
            this.set('joinStep.join.active', false);
            this.set('joinStep.join.active', false);
            this.set('joinStep.personalise.active', false);
            this.set('joinStep.features.active', false);
            switch (step) {
                case "join":
                    if (this.get('currentUser'))
                        return this.send('goToJoinStep', "personalise"); // Already joined.
                    this.set('joinStep.create.completed', true);
                    this.set('joinStep.join.disabled', false);
                    this.set('joinStep.join.active', true);
                    this.transitionToRoute('join.index');
                    this.controllerFor('application').set('redirectAfterLoginToRoute', 'create.personalise');
                    this.controllerFor('application').set('redirectAfterLoginToController', 'create');
                    break;
                case "personalise":
                    this.set('joinStep.join.completed', true);
                    this.set('joinStep.personalise.active', true);
                    this.set('joinStep.personalise.disabled', false);
                    this.transitionToRoute('join.personalise');
                    break;
                case "features":
                    this.set('joinStep.personalise.completed', true);
                    this.set('joinStep.features.active', true);
                    this.set('joinStep.features.disabled', false);
                    this.transitionToRoute('join.features');
                    break;
            }
            this.get('controllers.create').notifyPropertyChange('joinStep');
        }
    }
});
