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
    year: DS.attr('number'),
    course: DS.belongsTo('course', {async: true})
});
