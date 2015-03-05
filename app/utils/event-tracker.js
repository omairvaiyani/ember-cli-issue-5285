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

    VIEWED_RESULTS_PAGE: "Viewed Results Page",
    VIEWED_RESPONSE_STATISTICS: "Viewed Response Statistics",
    JOIN_TO_VIEW_ALL_RESPONSE_STATISTICS: "Join to View All Response Statistics",

    CREATED_TEST: "Created Test",
    STARTED_TEST: "Started Test",
    COMPLETED_TEST: "Completed Test",

    GENERATED_MEDICAL_TEST: "Generated Medical Test",

    JOINED_GROUP: "Joined Group",


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
        Zzish.getUser(currentUser.id, currentUser.get('name'));
    },

    /**
     * Analytics action for events
     * @param event {String} e.g. Test created
     * @param object {Object} (optional) e.g. Test
     * @param currentUser (optional)
     */
    recordEvent: function (event, object, currentUser) {
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
                    // object is Test (Can be Attempt, must avoid)
                    if (object.parseClassName() === "Test") {
                        eventProperties = {
                            title: object.get('title'),
                            category: object.get('category.name'),
                            author: object.get('author.name')
                        };
                        if(currentUser.get('zzishClasses.length')) {
                            var activityId = Zzish.startActivity(currentUser.id, "Taking a test",
                                currentUser.get('zzishClasses')[0], function (response) {
                                    console.dir(response);
                                });
                            // For local use to stop activity
                            currentUser.set('zzishActivityId:'+this.STARTED_TEST, activityId);
                        }
                    }
                    break;
                case this.COMPLETED_TEST:
                    // object is Test (Can be Attempt, must avoid)
                    eventProperties = {
                        title: object.get('test.title'),
                        category: object.get('testCategoryName'),
                        author: object.get('testAuthorName'),
                        score: object.get('score')
                    };
                    if(currentUser.get('zzishClasses.length')) {
                        Zzish.stopActivity(currentUser.get('zzishActivityId:'+this.STARTED_TEST), {
                            score: object.get('score')
                        });
                    }
                    break;
                case this.VIEWED_RESULTS_PAGE:
                    // object is Attempt
                    eventProperties = {
                        title: object.get('test.title'),
                        category: object.get('testCategoryName'),
                        author: object.get('test.author.name'),
                        score: object.get('score'),
                        user: object.get('user.name')
                    };
                    break;
                case this.VIEWED_RESPONSE_STATISTICS:
                    // object is Attempt
                    eventProperties = {
                        title: object.get('test.title'),
                        category: object.get('testCategoryName'),
                        author: object.get('test.author.name'),
                        score: object.get('score'),
                        user: object.get('user.name')
                    };
                    break;
                case this.JOIN_TO_VIEW_ALL_RESPONSE_STATISTICS:
                    // object is Attempt
                    eventProperties = {
                        title: object.get('test.title'),
                        category: object.get('testCategoryName'),
                        author: object.get('test.author.name'),
                        score: object.get('score')
                    };
                    break;
                case this.GENERATED_MEDICAL_TEST:
                    // object is basic javascript event params
                    eventProperties = object;
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
