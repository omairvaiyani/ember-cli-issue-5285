import
DS
from
'ember-data';

export default
DS.Model.extend(ParseMixin, {
    name: DS.attr('string'),
    facebookId: DS.attr('string'),
    institutionFacebookId: DS.attr('string'),
    courseLength: DS.attr('number')
});
