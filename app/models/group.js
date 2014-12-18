import DS from 'ember-data';
import Ember from 'ember';

export default DS.Model.extend({
    name: DS.attr('string'),
    creator: DS.belongsTo('parse-user', {async:true}),
    privacy: DS.attr('string', {defaultValue: "open"}),
    admins: DS.hasMany('parse-user', {array: true, async: true, defaultValue: new Ember.A()}),
    moderators: DS.hasMany('parse-user', {array: true, async: true, defaultValue: new Ember.A()}),
    members: new Ember.A(),
    gatheredTests: new Ember.A(),
    groupTests: new Ember.A(),
    photo: DS.attr('parse-file'),
    cover: DS.attr('parse-file'),
    coverStyle: function () {
        if(this.get('cover.url'))
            return "background-image:url("+this.get('cover.secureUrl')+");";
        else
            return "";
    }.property('cover.url'),
    slug: DS.attr('string'),
    course: DS.belongsTo('course', {async:true}),
    institution: DS.belongsTo('university', {async:true}),
    yearOrGrade: DS.attr('string')
});
