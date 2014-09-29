import DS from 'ember-data';

import
ParseMixin
from
'../mixins/ember-parse-mixin';

export default
DS.Model.extend(ParseMixin, {
    content: DS.attr('string'),
    slug: DS.attr('string'),
    title: DS.attr('string')
});