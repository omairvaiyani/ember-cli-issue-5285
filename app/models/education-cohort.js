import DS from 'ember-data';

export default DS.Model.extend({
    institution: DS.belongsTo('educational-institution', {async: true}),
    studyField: DS.belongsTo('study-field', {async: true}),
    currentYear: DS.attr('string'),
    graduationYear: DS.attr('number')
});
