import DS from 'ember-data';
import ParseMixin from '../mixins/ember-parse-mixin';

export default DS.Model.extend(ParseMixin, {
    level: DS.attr('number'),
    name: DS.attr('string'),
    // Not having belongTo here is allowing us to embed
    // the parent with ParseHelper.extractRawCategories
    // This may change on ember updates.
    parent: DS.attr(),
    totalTests: DS.attr('number', {defaultValue: 0}),
    slug: DS.attr('string'),
    hasChildren: DS.attr('boolean'),
    secondaryName: DS.attr('string')
});
