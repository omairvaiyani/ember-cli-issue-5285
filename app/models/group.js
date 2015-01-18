import DS from 'ember-data';
import Ember from 'ember';
import ParseHelper from '../utils/parse-helper';

export default DS.Model.extend({
    name: DS.attr('string'),
    creator: DS.belongsTo('parse-user', {async: true}),
    privacy: DS.attr('string', {defaultValue: "open"}),
    admins: DS.hasMany('parse-user', {array: true, async: true, defaultValue: new Ember.A()}),
    moderators: DS.hasMany('parse-user', {array: true, async: true, defaultValue: new Ember.A()}),
    members: new Ember.A(),
    gatheredTests: new Ember.A(),
    groupTests: new Ember.A(),
    photo: DS.attr('parse-file'),
    cover: DS.attr('parse-file'),
    coverStyle: function () {
        var pictureUrl;
        if (this.get('cover.url'))
            pictureUrl = this.get('cover.secureUrl');
        else if (this.get('educationCohort.studyField.cover.source'))
            pictureUrl = this.get('educationCohort.studyField.cover.source');
        else if (this.get('educationCohort.institution.cover.source'))
            pictureUrl = this.get('educationCohort.institution.cover.source');
        else
            pictureUrl = "https://d3uzzgmigql815.cloudfront.net/img/library-background-f134c78e09802f5470c970d15ec1723f.jpg";
        return "background-image:url(" + pictureUrl + ");";
    }.property('cover.url', 'educationCohort.studyField.cover.source',
        'educationCohort.institution.cover.source'),
    slug: DS.attr('string'),
    educationCohort: DS.belongsTo('education-cohort', {async: true}),
    course: DS.belongsTo('course', {async: true}),
    institution: DS.belongsTo('university', {async: true}),
    yearOrGrade: DS.attr('string'),
    membersCanInvite: DS.attr('boolean'),
    membersCanAddTests: DS.attr('boolean'),
    getMembers: function (store) {
        var where = {
            "$relatedTo": {
                "object": ParseHelper.generatePointer(this, "group"),
                "key": "members"
            }
        };
        return store.findQuery('parse-user', {where: JSON.stringify(where)})
            .then(function (members) {
                this.get('members').clear();
                this.get('members').addObjects(members);
                return members;
            }.bind(this));
    },
    getGatheredTests: function (store) {
        var where = {
            "$relatedTo": {
                "object": ParseHelper.generatePointer(this, "group"),
                "key": "gatheredTests"
            }
        };
        return store.findQuery('test', {where: JSON.stringify(where)})
            .then(function (results) {
                this.get('gatheredTests').clear();
                this.get('gatheredTests').addObjects(results);
                return results;
            }.bind(this));
    },
    getGroupTests: function (store) {
        var where = {
            "$relatedTo": {
                "object": ParseHelper.generatePointer(this, "group"),
                "key": "groupTests"
            }
        };
        return store.findQuery('test', {where: JSON.stringify(where)})
            .then(function (results) {
                this.get('groupTests').clear();
                this.get('groupTests').addObjects(results);
                return results;
            }.bind(this));
    }
});
