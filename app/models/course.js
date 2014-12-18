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
    name: DS.attr('string'),
    facebookId: DS.attr('string'),
    institution: DS.belongsTo('university', {async: true}),
    institutionFacebookId: DS.attr('string'),
    structure: DS.attr(),
    courseLength: DS.attr('number'),
    facebookPageUrl: function () {
        if(this.get('facebookId.length'))
            return "https://facebook.com/"+this.get('facebookId');
        else
            return "#";
    }.property('facebookId.length')
});
