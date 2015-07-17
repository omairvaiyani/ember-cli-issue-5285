import Ember from 'ember';
import DS from 'ember-data';
import ParseMixin from '../mixins/ember-parse-mixin';

/**
 * Parse User object implementation
 * @type {DS.Model}
 */
var ParseUser =  DS.Model.extend(ParseMixin, {
    /*
     * Account
     */
    username: DS.attr('string'),
    email: DS.attr('string'),
    emailVerified: DS.attr('boolean'),
    sessionToken: DS.attr('string'),
    signUpSource: DS.attr('string'),

    /*
     * Profile
     */
    slug: DS.attr('string'),
    name: DS.attr('string'),
    firstName: function () {
        if (this.get('name.length') && this.get('name').split(' ')[1])
            return this.get('name').split(' ').slice(0, -1).join(' ');
        else
            return this.get('name');
    }.property('name.length'),
    lastName: function () {
        if (this.get('name.length') && this.get('name').split(' ')[1])
            return this.get('name').split(' ')[this.get('name').split(' ').length - 1];
        else
            return "";
    }.property('name.length'),
    fbid: DS.attr('string'),
    gender: DS.attr('string'),
    timeZone: DS.attr('string'),
    profilePicture: DS.attr('parse-file'),
    profileImageURL: function () {
        if (this.get('profilePicture') && this.get('profilePicture.url')) {
            return this.get('profilePicture.secureUrl');
        } else if (this.get('fbid')) {
            return "https://graph.facebook.com/"+this.get('fbid')+"/picture?height=250&type=square";
            //return "https://res.cloudinary.com/mycqs/image/facebook/c_thumb,e_improve,g_faces:center,250/" + this.get('fbid');
        } else {
            return "https://d3uzzgmigql815.cloudfront.net/img/silhouette.png";
        }
    }.property('fbid', 'profilePicture'),

    coverPicture: DS.attr('parse-file'),
    coverImageOffsetY: 50,
    coverImageURL: function () {
        if (this.get('coverPicture') && this.get('coverPicture.url')) {
            return this.get('coverPicture.secureUrl');
        } else if (this.get('fbid')) {
            this.getFbCoverImage();
            return "";
        } else {
            return 'https://d3uzzgmigql815.cloudfront.net/img/coffee-revise.jpg';
        }
    }.property('fbid', 'coverImage'),
    getFbCoverImage: function () {
        $.getJSON("https://graph.facebook.com/" + this.get('fbid') + "?fields=cover")
            .then(function (data) {
                if (data) {
                    var cover = data.cover;
                    if (cover) {
                        if (cover.offset_y)
                            this.set('coverImageOffsetY', cover.offset_y);
                        this.set('coverImageURL', cover.source);
                    }
                }
            }.bind(this));
    },

    /*
     * Gamification
     */
    userEvents: DS.attr(),
    points: DS.attr('number', {defaultValue: 0}),
    level: DS.belongsTo('level', {async: true}),
    earnedBadges: DS.hasMany('badge', {async: true}),
    badgeProgressions: DS.hasMany('badge-progress', {async: true}),

    /*
     * Tests
     * - These two are relations on Parse
     * - Relations don't work well with the EmberAdapter
     * - So we load them manually onto these properties
     */
    createdTests: new Ember.A(),
    savedTests: new Ember.A(),


    /*
     * Interactions
     */
    testAttempts: DS.attr(),
    followers: DS.attr(),
    following: DS.attr(),

    /*
     * Spaced Repetition
     */
    srLatestAttempt:  DS.belongsTo('attempt', {async: true}),
    srCompletedAttempts: DS.attr(),
    srNextDue: DS.attr('parse-date'),
    uniqueResponses: new Ember.A(),
    srActivated: DS.attr('boolean'),
    srIntensityLevel: DS.attr('number'),

    /*
     * Stats
     */
    numberOfTestsCreated: DS.attr('number'),
    numberOfQuestionsCreated: DS.attr('number'),
    averageScore: DS.attr('number', {defaultValue: 0}),
    averageUniqueScore: DS.attr('number', {defaultValue: 0}),
    numberOfAttempts: DS.attr('number', {defaultValue: 0}),
    numberOfUniqueAttempts: DS.attr('number', {defaultValue: 0}),
    numberOfAttemptsByCommunity: DS.attr('number', {defaultValue: 0}),
    numberOfUniqueAttemptsByCommunity: DS.attr('number', {defaultValue: 0}),
    averageScoreByCommunity: DS.attr('number', {defaultValue: 0}),
    averageUniqueScoreByCommunity: DS.attr(),
    numberFollowing: DS.attr('number', {defaultValue: 0}),
    numberOfFollowers: DS.attr('number', {defaultValue: 0}),

    /*
     * Education
     */
    fbEducation: DS.attr(),
    educationCohort: DS.belongsTo('education-cohort', {async: true}),

    /*
     * Misc.
     */
    receivePromotionalEmails: DS.attr('boolean'),

    /*
     * Local
     */
    myTests: function () {
        var myTests = new Ember.A();

        if(this.get('createdTests'))
            myTests.pushObjects(this.get('createdTests'));
        if(this.get('savedTests'))
            myTests.pushObjects(this.get('savedTests'));

        return myTests.sortBy('title');
    }.property('createdTests.length', 'savedTests.length')
});

ParseUser.reopenClass({

    requestPasswordReset: function (email) {
        var adapter = this.get('store').adapterFor(this);
        var data = {email: email};
        return adapter.ajax(adapter.buildURL("requestPasswordReset"), "POST", {data: data})['catch'](
            function (response) {
                return Ember.RSVP.reject(response.responseJSON);
            }
        );
    },

    login: function (store, data) {
        if (Ember.isEmpty(this.typeKey)) {
            throw new Error('Parse login must be called on a model fetched via store.modelFor');
        }
        var model = this;
        var adapter = store.adapterFor(model);
        var serializer = store.serializerFor(model);
        return adapter.ajax(adapter.buildURL("login"), "GET", {data: data}).then(
            function (response) {
                serializer.normalize(model, response);
                var record = store.push(model, response);
                return record;
            },
            function (response) {
                return Ember.RSVP.reject(response.responseJSON);
            }
        );
    },

    /*
     * Modified by Omair:
     * - Changed adapter.buildURL() to send "signup" as the param
     * - This is intercepted by pathForType, which is also modified by Omair
     */
    signup: function (store, data) {
        if (Ember.isEmpty(this.typeKey)) {
            throw new Error('Parse signup must be called on a model fetched via store.modelFor');
        }
        var model = this;
        var adapter = store.adapterFor(model);
        var serializer = store.serializerFor(model);
        return adapter.ajax(adapter.buildURL("signup"), "POST", {data: data}).then(
            function (response) {
                serializer.normalize(model, response);
                response.email = response.email || data.email;
                response.username = response.username || data.username;
                var record = store.push(model, response);
                return record;
            },
            function (response) {
                return Ember.RSVP.reject(response.responseJSON);
            }
        );
    },

    validateSessionToken: function (store, sessionToken) {
        if (Ember.isEmpty(this.typeKey)) {
            throw new Error('Parse login must be called on a model fetched via store.modelFor');
        }
        var model = this;
        var adapter = store.adapterFor(model);
        adapter.headers['X-Parse-Session-Token'] = sessionToken;
        var serializer = store.serializerFor(model);
        return adapter.ajax(adapter.buildURL("users/me"), "GET", {data: {}}).then(
            function (response) {
                serializer.normalize(model, response);
                var record = store.push(model, response);
                return record;
            },
            function (response) {
                return Ember.RSVP.reject(response.responseJSON);
            }
        );
    }
});

export default ParseUser;
