export default
{
    WEBSITE_OPENED: "Website Opened",
    REGISTERED_WITH_EMAIL: "Did register with email",
    REGISTERED_WITH_FACEBOOK: "Did register with facebook",
    LOGGED_IN: "Logged in",

    /**
     * On-boarding
     * Not used yet
     */
    ONBOARDING_CREATE_TEST: "Onboarding: Create Test",
    ONBOARDING_JOIN: "Onboarding: Join",
    ONBOARDING_FACEBOOK: "Onboarding: Facebook",
    ONBOARDING_WITH_EMAIL: "Onboarding: Email",
    ONBOARDING_PERSONALISE: "Onboarding: Personalise",
    ONBOARDING_PERSONALISE_SET_PROFILE_PICTURE: "Onboarding: Set Profile Picture",
    ONBOARDING_PERSONALISE_PROFILE_PICTURE_SKIPPED: "Onboarding: Profile Picture Skipped",
    ONBOARDING_PERSONALISE_SET_EDUCATION: "Onboarding: Set Education",
    ONBOARDING_PERSONALISE_EDUCATION_SKIPPED: "Onboarding: Education Skipped",
    ONBOARDING_PERSONALISE_SET_FOLLOWING: "Onboarding: Set Following",
    ONBOARDING_PERSONALISE_FOLLOWING_SKIPPED: "Onboarding: Following Skipped",
    ONBOARDING_SELECT_PACKAGE: "Onboarding: Select Package",
    ONBOARDING_SELECTED_BASIC_PACKAGE: "Onboarding: Selected Basic Package",
    ONBOARDING_SELECTED_PREMIUM_PACKAGE: "Onboarding: Selected Premium Package",
    ONBOARDING_COMPLETED: "Onboarding: Completed",
    ONBOARDING_CANCELLED: "Onboarding: Cancelled",

    CREATED_TEST: "Created Test",
    STARTED_TEST: "Started Test",
    COMPLETED_TEST: "Completed Test",


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
        /*
         * Zzish
         */
       /* Zzish.getUser(user.id, user.get('name'));
        var activityId = Zzish.startActivity(user.id,"Logged In","p6t",function(err,message) {
            if (err) {
                console.log("Error" + message);
            }
            else {
                console.log("Activity response",message);
            }
        });*/
    },

    /**
     * Analytics action for events
     * @param event {String} e.g. Test created
     * @param object {Object} (optional) e.g. Test
     */
    recordEvent: function (event, object) {
        var eventProperties = {source: "Web"};
        if (object) {
            switch (event) {
                case this.CREATED_TEST:
                    // object is Test
                    eventProperties = {
                        title: object.get('title'),
                        category: object.get('category.name'),
                        author: object.get('author.name'),
                        group: object.get('group.name')
                    };
                    break;
                case this.STARTED_TEST:
                    // object is Attempt
                    eventProperties = {
                        title: object.get('title'),
                        category: object.get('category.name'),
                        author: object.get('author.name')
                    };
                    break;
                case this.COMPLETED_TEST:
                    // object is Attempt
                    eventProperties = {
                        title: object.get('test.title'),
                        category: object.get('testCategoryName'),
                        author: object.get('testAuthorName'),
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
