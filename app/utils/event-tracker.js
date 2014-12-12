export default
{
    LOGGED_IN: "Logged in",
    TEST_CREATED: "Test created",
    TEST_TAKEN: "Test taken",

    /**
     * Track Flow
     * Follows a user as they go from page to page
     *
     * Not used currently.
     */
    trackFlow: function () {
        /*
         * Mixpanel
         */
        mixpanel.track_links("a", "Navigated", {
            "referrer": document.referrer
        });
    },

    /**
     * Profile User
     * @param currentUser
     */
    profileUser: function (currentUser) {
        /*
         * Mixpanel
         */
        mixpanel.identify(currentUser.id);
        mixpanel.people.set({
            "$first_name": currentUser.firstName,
            "$last_name": currentUser.lastName,
            "$created": currentUser.createdAt,
            "$email": currentUser.get('privateData.email'),
            "profilePicture": currentUser.get('profileImageURL'),
            "facebookId": currentUser.get('fbid'),
            "course": currentUser.get('course.name'),
            "year": currentUser.get('yearNumber')
        });
    },

    /**
     * Analytics action for events
     * @param event {String} e.g. Test created
     * @param object {Object} (optional) e.g. Test
     */
    recordEvent: function (event, object) {
        var eventProperties = {};
        if (object) {
            switch (event) {
                case this.TEST_CREATED:
                    eventProperties = {
                        title: object.get('title'),
                        category: object.get('category.name')
                    };
                    break;
                case this.TEST_TAKEN:
                    eventProperties = {
                        title: object.get('test.title'),
                        category: object.get('testCategoryName'),
                        score: object.get('score')
                    };
                    break;
            }
        }
        /*
         * Amplitude
         */
        amplitude.logEvent(event, eventProperties);
        /*
         * Mixpanel
         */
        mixpanel.track(event, eventProperties);
    }
}
