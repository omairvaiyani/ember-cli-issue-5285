import Ember from 'ember';
import CurrentUser from '../mixins/current-user';
import ParseHelper from '../utils/parse-helper';

export default Ember.Controller.extend(CurrentUser, {
    needs: ['application', 'create'],

    setRedirectPostSignUp: function () {
        this.get('controllers.application').set('redirectAfterLoginToRoute', 'join.personalise');
        this.get('controllers.application').set('redirectAfterLoginToController', 'join');
    }.on('init'),
    /*
     * Join process
     */
    joinStep: {
        join: {
            active: false,
            disabled: false,
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
        completed: false
    },

    actions: {
        goToJoinStep: function (step) {
            if (step === 'create' || step === 'addQuestions') {
                this.get('controllers.create').send('goToJoinStep', step);
                return;
            }
            if (this.get('joinStep.create')) {
                this.set('joinStep.create.active', false);
                this.set('joinStep.join.active', false);
            }
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
        },

        registrationComplete: function () {
            if (this.get('joinStep.addQuestions'))
                this.send('goToJoinStep', 'addQuestions');
            else {
                this.transitionToRoute('index');
                // Check if its a MyCQs user, and ask them to migrate
                // their tests over
                ParseHelper.cloudFunction(this, "checkIfUserExistsOnMyCQs",
                    {
                        email: this.get('currentUser.email'),
                        password: this.get('controllers.application.newUser.password')
                    })
                    .then(function (response) {
                        if (response.sessionToken) {
                            this.set('currentUser.firstTimeLogin', true); // Needed by migrate-tests controller
                            this.send('openModal', 'application/modal/migrate-tests');
                        }
                    }.bind(this), function (error) {
                        console.dir(error);
                    });

            }
        },

        returnedFromRedirect: function () {
            // Not why why join.active goes back to true, but we
            // need it to be false.
            setTimeout(function () {
                this.send('goToJoinStep', 'personalise');
            }.bind(this), 400);
        }
    }
});
