import Ember from 'ember';
import CurrentUser from '../../mixins/current-user';
import ImageUpload from '../../mixins/image-upload';

export default Ember.Controller.extend(CurrentUser, ImageUpload, {
    needs: ['user', 'join'],

    userController: function () {
        return this.get('controllers.user');
    }.property('controllers.user'),

    initialize: function () {
        this.get('userController').set('model', this.get('currentUser'));
    }.on('init'),

    currentStep: 1,

    step1: true,
    step2: false,
    step3: false,

    showGoBack: false,
    showSkip: true,

    setProfileImage: function () {
        this.set('imageFile.style', "background-image:url('" +
        this.get('currentUser.profileImageURL') + "');");
        this.set('imageFile.url', this.get('currentUser.profileImageURL'));
        if(this.get('currentUser.profilePicture') || this.get('currentUser.fbid'))
            this.set('imageFile.isDefault', false);
    }.observes('currentUser.profileImageURL.length'),

    moreSuggestionsToShow: function () {
        return this.get('userController.suggestedFollowingAll.length') > 5;
    }.property('userController.suggestedFollowingAll.length'),

    followingAllComplete: function () {
        if (this.get('beganFollowingAll') && !this.get('userController.suggestedFollowingAll.length')) {
            setTimeout(function () {
                this.send('nextStep');
            }.bind(this), 800);
            this.set('beganFollowingAll', false);
        }
    }.observes('beganFollowingAll', 'userController.suggestedFollowingAll.length'),

    actions: {
        nextStep: function () {
            if (this.get('currentStep') === 3) {
                this.get('controllers.join').send('goToJoinStep', 'features');
                return;
            }

            this.incrementProperty('currentStep');
            this.set('step1', false);
            this.set('step2', false);
            this.set('step3', false);
            // Set current step as active
            this.set('step' + this.get('currentStep'), true);

            this.set('showGoBack', true);
        },
        previousStep: function () {
            this.decrementProperty('currentStep');
            this.set('step1', false);
            this.set('step2', false);
            this.set('step3', false);
            // Set current step as active
            this.set('step' + this.get('currentStep'), true);

            this.set('showSkip', true);
            if (this.get('currentStep') === 1)
                this.set('showGoBack', false);
        },
        //step1
        acceptProfilePicture: function () {
            if (this.get('imageFile.url') !== this.get('currentUser.profileImageURL')) {
                this.send('uploadImage');
            }
            this.send('nextStep');
        },
        saveUploadedImage: function (image) {
            this.send('incrementLoadingItems');
            this.set('currentUser.profilePicture', image);
            this.get('currentUser').save()
                .then(function () {
                    this.send('decrementLoadingItems');
                }.bind(this),
                function (error) {
                    console.dir(error);
                    this.send('decrementLoadingItems');
                }.bind(this));
        },
        //step 2
        acceptEducationInfo: function () {
            this.set('currentUser.educationInfoConfirmed', true);
            this.get('currentUser').save();
            this.send('nextStep');
        },

        //step 3
        followAllSuggestedFollowing: function (callback) {
            this.set('beganFollowingAll', true);
            this.get('userController').send('followAllSuggestedFollowing', callback);
        }
    }
});
