import DS from 'ember-data';

export default DS.Model.extend({
    name: DS.attr('string'),
    admin: DS.belongsTo('parse-user', {async:true}),
    privacy: DS.attr('string', {defaultValue: "open"}),
    moderators: DS.hasMany('parse-user', {array: true, async: true}),
    members: DS.attr({relation: true, async: true}),
    gatheredTests: DS.attr({relation: true, async: true}),
    tests: DS.attr({array: true, async: true}),
    photo: DS.attr('parse-file'),
    slug: DS.attr('string'),
    course: DS.belongsTo('course', {async:true}),
    institution: DS.belongsTo('university', {async:true}),
    yearOrGrade: DS.attr('string')
});
