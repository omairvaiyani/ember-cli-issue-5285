import Ember from 'ember';
import CurrentUser from '../../mixins/current-user';

export default Ember.ObjectController.extend(CurrentUser, {
    isForCourse: false,

    privacyOptions: function () {
        var privacyOptions = [
            {
                value: "open"
            },
            {
                value: "closed"
            },
            {
                value: "secret"
            }];
        switch(this.get('privacy')) {
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

    privacyDescription: function () {
        var privacyDescription;
        switch(this.get('privacy')) {
            case "open":
                privacyDescription = "This group will be open to the public. Anyone can view its tests, join the group" +
                " and post comments.";
                break;
            case "closed": // lol
                privacyDescription = "This group will be invite only. The public can find this group and see who's in" +
                " it, but they cannot take tests made for the group.";
                break;
            case "secret":
                privacyDescription = "This group will be hidden from our website and search results. You can share the" +
                " link with others so that they can interact with it as if it was a closed group. Member lists" +
                " will be hidden.";
                break;
        }
        return privacyDescription;
    }.property('privacy.length'),

    suggestedSlug: function () {
        if (this.get('name.length'))
            return this.get('name').toLowerCase().replace(' - ', ' ').split(' ').join('-');
    }.property('name.length'),

    actions: {
        createGroup: function () {
            var errorMessage;
            if (!this.get('name.length'))
                errorMessage = "Please enter a name for the group!";

            if (errorMessage)
                return this.send('addNotification', 'warning', 'Hold on!', errorMessage);

            this.set('admin', this.get('currentUser'));
            this.send('incrementLoadingItems');
            this.get('model').save()
                .then(function () {
                    this.send('decrementLoadingItems');
                    this.transitionTo('group', this.get('model'));
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
        setPrivacy: function (privacy) {
            this.set('privacy', privacy);
        }
    }
});
