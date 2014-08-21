import
DS
from
'ember-data';

export default
DS.Model.extend(ParseMixin, {
    fullName: DS.attr('string'),
    shortName: DS.attr('string'),
    facebookId: DS.attr('string')
});
