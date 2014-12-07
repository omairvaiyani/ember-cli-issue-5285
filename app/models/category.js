import DS from 'ember-data';

import
ParseMixin
from
'../mixins/ember-parse-mixin';

export default DS.Model.extend(ParseMixin, {
    level: DS.attr('number'),
    name: DS.attr('string'),
    parent: DS.belongsTo('category', {async:true}),
    totalTests: DS.attr('number', {defaultValue: 0}),
    slug: DS.attr('string'),
    hasChildren: DS.attr('boolean'),
    secondaryName: DS.attr('string'),
    parentCategoryName: function () {
        return this.get('_data.parent._data.name');
    }.property(),
    parentCategorySlug: function () {
        return this.get('_data.parent._data.slug');
    }.property()
});
