import DS from 'ember-data';
import ParseMixin from '../mixins/ember-parse-mixin';

export default DS.Model.extend(ParseMixin, {
    institution: DS.belongsTo('institution', {async: true}),
    studyField: DS.belongsTo('study-field', {async: true}),
    currentYear: DS.attr('string'),
    graduationYear: DS.attr('number'),
    moduleTags: DS.attr()
});
