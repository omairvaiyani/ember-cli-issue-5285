import Ember from 'ember';
import CurrentUser from '../../mixins/current-user';

export default Ember.ObjectController.extend(CurrentUser, {
    isForCourse: function () {
        if(this.get('course') || this.get('institution'))
            return true;
        this.set('course', this.get('currentUser.course'));
        this.set('institution', this.get('currentUser.institution'));
        if (this.get('currentUser.course') || this.get('currentUser.institution'))
            return true;
        else
            return false;
    }.property('currentUser.course', 'currentUser.institution'),

    privacyOptions: function () {
        var privacyOptions = [
            {
                value: "open",
                description: "This group will be open to the public. Anyone can view its tests, join the group" +
                " and post comments."
            },
            {
                value: "closed",
                description: "This group will be invite only. The public can find this group and see who's in" +
                " it, but they cannot take tests made for the group."
            },
            {
                value: "secret",
                description: "This group will be hidden from our website and search results. You can share the" +
                " link with others so that they can interact with it as if it was a closed group. Member lists" +
                " will be hidden."
            }];
        switch (this.get('privacy')) {
            case "open":
                privacyOptions[0].isSelected = true;
                break;
            case "closed": // lol
                privacyOptions[1].isSelected = true;
                break;
            case "secret":
                privacyOptions[2].isSelected = true;
                break;
        }
        return privacyOptions;
    }.property('privacy.length'),

    suggestedSlug: function () {
        if (this.get('name.length'))
            return this.get('name').toLowerCase().replace(' - ', ' ').split(' ').join('-');
    }.property('name.length'),

    courseSuggestions: function () {
        return new Ember.A();
    }.property(),

    institutionSuggestions: function () {
        return new Ember.A();
    }.property(),

    actions: {
        courseSelected: function (record, name) {
            if (record) {
                this.store.find('course', record.external_id)
                    .then(function (course) {
                        this.set('course', course);
                        return course.get('institution');
                    }.bind(this))
                    .then(function (institution) {
                        this.set('institution', institution);
                    }.bind(this));
            } else {
                var newCourse = this.store.createRecord('course', {
                    name: name
                });
                this.set('course', newCourse);
            }
        },
        institutionSelected: function (record, name) {
            if (record) {
                this.store.find('university', record.external_id)
                    .then(function (institution) {
                        this.set('institution', institution);
                    }.bind(this));
            } else {
                var newInstitution = this.store.createRecord('university', {
                    fullName: name
                });
                this.set('institution', newInstitution);
            }
        },
        createGroup: function () {
            var errorMessage;
            if (!this.get('name.length'))
                errorMessage = "Please enter a name for the group!";

            if (errorMessage)
                return this.send('addNotification', 'warning', 'Hold on!', errorMessage);

            this.set('creator', this.get('currentUser'));
            //this.get('admins').pushObject(this.get('currentUser'));
            this.send('incrementLoadingItems');
            // TODO verify slug
            this.set('slug', this.get(('suggestedSlug')));
            this.get('model').save()
                .then(function () {
                    this.send('decrementLoadingItems');
                    this.transitionToRoute('group', this.get('model.slug'));
                }.bind(this),
                function (error) {
                    this.send('decrementLoadingItems');
                    if (error && error.message)
                        return this.send('addNotification', 'warning', 'Something went wrong!', error.message);
                    else
                        return this.send('addNotification', 'warning', 'Something went wrong!', "Please try again later.");
                }.bind(this)
            )
        },
        saveGroup: function (callback) {
            if ((this.get('course.name') && !this.get('course.id') ) ||
                (this.get('institution.fullName') && !this.get('institution.id') )) {
                var promise =
                    Parse.Cloud.run('updateUserEducation', {
                        education: {
                            courseName: this.get('course.name'),
                            courseFacebookId: this.get('course.facebookId'),
                            institutionName: this.get('institution.fullName'),
                            institutionFacebookId: this.get('institution.facebookId'),
                            yearNumber: this.get('yearOrGrade')
                        },
                        groupId: this.get('id')
                    });
                callback(promise);
                promise.then(function (response) {
                    var institution = response.institution,
                        course = response.course;

                    this.send('closeModal');
                    this.send('addNotification', 'saved', 'Group changes saved!');
                    this.get('model').save();
                }.bind(this));
            } else {
                this.send('closeModal');
                var promise = this.get('model').save();
                callback(promise);
                promise.then(function () {
                    this.send('addNotification', 'saved', 'Group changes saved!');
                }.bind(this));
            }
        },
        setPrivacy: function (privacy) {
            this.set('privacy', privacy);
        }
    }
});
