import
DS
from
'ember-data';

export default
DS.Model.extend(ParseMixin, {
    year: DS.attr('number'),
    course: DS.belongsTo('course', {async: true})
});
