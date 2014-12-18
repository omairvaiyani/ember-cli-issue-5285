import Ember from 'ember';
import CurrentUser from '../../mixins/current-user';

export default Ember.ObjectController.extend(CurrentUser, {
    isForCourse: false,

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

            this.set('creator', this.get('currentUser'));
            this.get('admins').pushObject(this.get('currentUser'));
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
        setPrivacy: function (privacy) {
            this.set('privacy', privacy);
        }
    }
});
