import
Ember
from
'ember';

import
CurrentUser
from
'../mixins/current-user';

import
ParseHelper
from
'../utils/parse-helper';

export default
Ember.ObjectController.extend(CurrentUser, {
    loading: {
        autocompleteInstitutionNames: false
    },

    isMainListRecentActivity: true,
    isMainListTests: false,

    isCurrentUser: function () {
        return this.get('currentUser.id') === this.get('model.id');
    }.property('model.id'),

    isFollowing: function () {
        if (!this.get('isCurrentUser') && this.get('currentUser.following.length')) {
            return this.get('currentUser.following').contains(this.get('model'));
        } else {
            return false;
        }
    }.property('isCurrentUser', 'currentUser.following.length'),

    coverImageStyle: function () {
        var coverImageURL = this.get('coverImageURL');
        if (!coverImageURL)
            coverImageURL = "http://medical.mycqs.com/startup/common-files/img/NY_002.jpg"

        return "background-image:url(" + coverImageURL + ");";
    }.property('coverImageURL'),

    courseFacebookPageUrl: function () {
        if (!this.get('course.facebookId'))
            return;
        return "https://www.facebook.com/" + this.get('course.facebookId');
    }.property('course.facebookId'),

    institutionFacebookPageUrl: function () {
        if (!this.get('institution.facebookId'))
            return;
        return "https://www.facebook.com/" + this.get('institution.facebookId');
    }.property('institution.facebookId'),

    tests: [],

    getTests: function () {
        if (!this.get('model.id'))
            return;

        this.get('tests').clear();

        var where = {
            author: ParseHelper.generatePointer(this.get('model'))
        };
        this.store.findQuery('test', {
            where: JSON.stringify(where),
            include: ["author"],
            order: 'title'
        }).then(function (tests) {
                this.get('tests').addObjects(tests);
            }.bind(this));
    }.observes('model'),

    userActions: [],

    getUserActionsAndModify: function () {
        if (!this.get('model.id'))
            return;

        this.get('userActions').clear();
        var query = {
            user: ParseHelper.generatePointer(this.get('model')),
            type: {"$nin": ["questionAnswered", "attemptStarted"]}
        };
        this.store.findQuery('action', {
            where: JSON.stringify(query),
            order: "-createdAt",
            limit: 15
        }).then(function (userActions) {
                userActions.forEach(function (userAction) {
                    switch (userAction.get('type')) {
                        case "joinedMyCQs":
                            userAction.set('title', " joined MyCQs!");
                            break;
                        case "testCreated":
                            userAction.set('title', " created a new test");
                            break;
                        case "attemptFinished":
                            userAction.set('title', " took a test");
                            break;
                    }
                }.bind(this));
                this.get('userActions').addObjects(userActions);
            }.bind(this));
    }.observes('model'),

    /*
     * Object for new course creation
     */
    newCourse: {
        institutionName: '',
        concentrationName: '',
        yearName: 0
    },

    autocompleteInstitutionNames: [],
    getInstitutionNamesForAutocomplete: function () {
        if (this.get('newCourse.institutionName.length') < 2) {
            this.get('autocompleteInstitutionNames').clear();
            this.set('loading.autocompleteInstitutionNames', false);
            return;
        }
        this.set('loading.autocompleteInstitutionNames', true);
        var stopWords = ParseHelper.stopWords,
            tags = _.filter(this.get('newCourse.institutionName').toLowerCase().split(' '), function (w) {
                return w.match(/^\w+$/) && !_.contains(stopWords, w);
            });
        var where = {
            "tags": {
                "$all": tags
            }
        };
        this.store.findQuery('institution-list', {where: JSON.stringify(where)})
            .then(function (institutionList) {
                this.set('loading.autocompleteInstitutionNames', false);
                this.get('autocompleteInstitutionNames').clear();
                if (institutionList.get('content.length'))
                    this.get('autocompleteInstitutionNames').addObjects(institutionList.get('content'));

            }.bind(this));
    },

    throttleAutocompleteInstitutionNames: function () {
        Ember.run.debounce(this, this.getInstitutionNamesForAutocomplete, 250);
    }.observes("newCourse.institutionName.length"),

    autocompleteCourseNames: [],
    getCourseNamesForAutocomplete: function () {
        if (this.get('newCourse.courseName.length') < 2) {
            this.get('autocompleteCourseNames').clear();
            this.set('loading.autocompleteCourseNames', false);
            return;
        }
        this.set('loading.autocompleteCourseNames', true);
        var stopWords = ParseHelper.stopWords,
            tags = _.filter(this.get('newCourse.courseName').toLowerCase().split(' '), function (w) {
                return w.match(/^\w+$/) && !_.contains(stopWords, w);
            });
        var where = {
            "tags": {
                "$all": tags
            }
        };
        this.store.findQuery('course-list', {where: JSON.stringify(where)})
            .then(function (courseList) {
                this.set('loading.autocompleteCourseNames', false);
                this.get('autocompleteCourseNames').clear();
                if (courseList.get('content.length'))
                    this.get('autocompleteCourseNames').addObjects(courseList.get('content'));

            }.bind(this));
    },

    throttleAutocompleteCourseNames: function () {
        Ember.run.debounce(this, this.getCourseNamesForAutocomplete, 250);
    }.observes("newCourse.courseName.length"),

    /*
     * Object for course-selection modal
     */
    selectedCourse: null,

    courseYearsToChooseFrom: [0, 1, 2, 3, 4, 5, 6],
    courseLengthsToChooseFrom: [1, 2, 3, 4, 5, 6, 7],

    latestAttemptsReceived: false,
    getLatestAttempts: function () {
        if (this.get('latestAttempts.length'))
            this.set('latestAttemptsReceived', true);
    }.observes('latestAttempts.length'),

    actions: {

        switchList: function (list) {
            switch (list) {
                case "recentActivity":
                    this.set('isMainListRecentActivity', true);
                    this.set('isMainListTests', false);
                    break;
                case "tests":
                    this.set('isMainListRecentActivity', false);
                    this.set('isMainListTests', true);
                    break;
            }
        },

        courseSelected: function (course) {
            this.set('selectedCourse', course);
            /*
             * Try to determin course length based on name
             * But we'll allow users to manually change it
             */
            if (course.concentration[0].name === "Medicine" ||
                course.concentration[0].name === "Dentsitry")
                this.set('selectedCourse.courseLength', 5);
            else if (course.concentration[0].name === "law")
                this.set('selectedCourse.courseLength', 4);
            else
                this.set('selectedCourse.courseLength', 3);


            var graduationYear = parseInt(course.year.name),
                currentCalendarYear = new Date().getFullYear(),
                currentYearInCourse;

            /*
             * Try to determine current year of study based on:
             * - graduation year
             * - length of course
             * - current calendar year
             */

            if (graduationYear > currentCalendarYear) {
                var yearsLeftToGraduate = graduationYear - currentCalendarYear;
                currentYearInCourse = this.get('selectedCourse.courseLength') - yearsLeftToGraduate;
            } else {
                currentYearInCourse = this.get('selectedCourse.courseLength');
            }
            if (currentYearInCourse < 0)
                currentYearInCourse = 1;

            this.set('selectedCourse.currentYear', currentYearInCourse);
        },

        saveCourseChanges: function () {
            var selectedCourse = this.get('selectedCourse');
            /*
             * See if the selectedCourse.school exists
             * as an institution on our database
             */
            var where = {
                'facebookId': selectedCourse.school.id
            };
            this.store.findQuery('university', {where: JSON.stringify(where)})
                .then(function (results) {
                    /*
                     * Results: Institutions matching the given facebookId
                     */
                    if (results.content.length) {
                        /*
                         * Institution found, setting it on the currentUser
                         */
                        this.set('institution', results.content[0]);
                    } else {
                        /*
                         * Institution not found, create a new one
                         */
                        var newUniversity = this.store.createRecord('university', {
                            facebookId: selectedCourse.school.id,
                            fullName: selectedCourse.school.name
                        });
                        newUniversity.save().then(function (newUniversity) {
                            /*
                             * New Institution saved and set on the currentUser
                             */
                            this.set('institution', newUniversity);
                        }.bind(this));
                    }
                    /*
                     * Regardless of whether the institution was found or
                     * a new one was set,
                     * Look for the selectedCourse.concentration on
                     * our database Course table:
                     * - Has to match facebookId
                     * - Has to be the right courseLength
                     */
                    var where = {
                        'facebookId': selectedCourse.concentration[0].id,
                        'courseLength': selectedCourse.courseLength
                    };
                    return this.store.findQuery('course', {where: JSON.stringify(where)});
                }.bind(this))
                .then(function (results) {
                    /*
                     * Results: Courses matching given facebookId and courseLength
                     */
                    if (results.content.length) {
                        /*
                         * Set the course for the currentUser and
                         * return a promise, looking for a Year object matching
                         * the currentYear and course
                         */
                        this.set('course', results.content[0]);
                        var where = {
                            year: selectedCourse.currentYear,
                            course: ParseHelper.generatePointer(results.content[0])
                        };
                        return this.store.findQuery('year', {where: JSON.stringify(where)});
                    } else {
                        /*
                         * Course not found, create a new course object
                         */
                        var newCourse = this.store.createRecord('course', {
                            facebookId: selectedCourse.concentration[0].id,
                            name: selectedCourse.concentration[0].name,
                            courseLength: selectedCourse.courseLength,
                            institutionFacebookId: selectedCourse.school.id
                        });
                        /*
                         * Save the new course and subsequently create
                         * a new year with the currentYear and newCourse values
                         */
                        newCourse.save()
                            .then(function (newCourse) {
                                this.set('course', newCourse);
                                var newYear = this.store.createRecord('year', {
                                    year: selectedCourse.currentYear,
                                    course: newCourse
                                });
                                return newYear.save();
                            }.bind(this))
                            .then(function (newYear) {
                                this.set('year', newYear);
                                this.get('model').save();
                            }.bind(this));
                        return null;
                    }
                }.bind(this)).then(function (results) {
                    if (results && results.content.length) {
                        this.set('year', results.content[0]);
                        return this.get('model').save();
                    } else {
                        return;
                    }
                }.bind(this)).then(function () {
                    // Course selection and education history all sorted!
                    this.send('closeModal');
                }.bind(this));
        }
    }
});
