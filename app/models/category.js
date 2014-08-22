import DS from 'ember-data';

export default DS.Model.extend(ParseMixin, {
    level: DS.attr('number'),
    name: DS.attr('string'),
    parent: DS.belongsTo('category', {async:true}),
    totalTests: DS.attr('number', {defaultValue: 0}),
    slug: DS.attr('string')
});
