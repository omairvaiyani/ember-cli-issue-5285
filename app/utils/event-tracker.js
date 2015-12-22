export default
{
    USER_REGISTERED: "User Registered",

    USER_LOGGED_IN: "User Logged In",

    VIEWED_CREATE_PAGE: "Viewed Create Page",
    CREATED_A_TEST: "Created A Test",
    WRITTEN_A_QUESTION: "Written A Question",

    VIEWED_TEST_INFO: "Viewed Test Info",
    BEGAN_TEST: "Began Test",
    COMPLETED_TEST: "Completed Test",
    CLICKED_RETRY_RESULT: "Clicked Retry In Result",

    VIEWED_BROWSE_HOME: "Viewed Browse Home",
    SEARCHED_BROWSE_HOME: "Searched On Browse Home",
    CLICKED_SEARCH_RESULT_BROWSE_HOME: "Clicked Search Result On Browse Home",
    CLICKED_CATEGORY_BROWSE_HOME: "Clicked Category On Browse Home",

    VIEWED_CATEGORY: "Viewed Category",
    VIEWED_SUBCATEGORY: "Viewed Subcategory",
    SEARCHED_CATEGORY: "Searched Category",
    SEARCHED_SUBCATEGORY: "Searched Subcategory",

    VIEWED_PROFILE: "Viewed Profile",
    FOLLOWED_USER: "Followed User",
    UNFOLLOWED_USER: "Unfollowed User",

    VIEWED_PROGRESS: "Viewed Progress",

    SHARED_TEST_SOCIAL: "Shared Test On Social Media",

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
            referrer: document.referrer
        });

    },

    /**
     * Profile User
     * @param currentUser
     */
    profileUser: function (currentUser) {
        var userProperties = {
            "Picture": currentUser.get('profileImageURL'),
            "Facebook Profile": "https://facebook.com/" + currentUser.get('fbid'),
            "University": currentUser.get('educationCohort.institution.name'),
            "Course": currentUser.get('educationCohort.studyField.name'),
            "Year": currentUser.get('educationCohort.currentYear'),
            "Source": currentUser.get('signUpSource'),
            "Study Intensity": currentUser.get('srIntensityLevel')
        };
        /*
         * Mixpanel
         */
        mixpanel.identify(currentUser.get('id'));
        mixpanel.people.set(_.extend(userProperties, {
            "$first_name": currentUser.get('firstName'),
            "$last_name": currentUser.get('lastName'),
            "$created": currentUser.get('createdAt'),
            "$email": currentUser.get('email')
        }));
        /*
         * Amplitude
         */
        amplitude.setUserId(currentUser.id);
        amplitude.setUserProperties(_.extend(userProperties, {
            "First Name": currentUser.get('firstName'),
            "Last Name": currentUser.get('lastName'),
            "Joined": currentUser.get('createdAt'),
            "Email": currentUser.get('email')
        }));
        /*
         * Google analytics
         */
        ga('set', '&uid', currentUser.get('id'));

        this.recordEvent(this.USER_LOGGED_IN);
    },

    /**
     * Analytics action for events
     * @param {String} event
     * @param {Object} extraProperties
     */
    recordEvent: function (event, extraProperties) {
        var eventProperties = {Source: "Web"};
        if(extraProperties)
            eventProperties = _.extend(eventProperties, extraProperties);
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
