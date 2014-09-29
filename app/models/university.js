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
    fullName: DS.attr('string'),
    shortName: DS.attr('string'),
    facebookId: DS.attr('string')
});
