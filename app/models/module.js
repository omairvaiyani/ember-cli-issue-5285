import
DS
from
'ember-data';

import
ParseMixin
from
'../mixins/ember-parse-mixin';

export default
DS.Model.extend(ParseMixin, {
    category: DS.attr('string'),
    description: DS.attr('string'),
    fullName: DS.attr('string'),
    level: DS.attr('number'),
    parentCategory: DS.attr('string'),
    shortName: DS.attr('string'),
    tags: DS.attr({defaultValue: []})
});
