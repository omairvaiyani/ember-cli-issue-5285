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
    user: DS.belongsTo('parse-user', {async: true}),
    type: DS.attr('string'),
    test: DS.belongsTo('test', {async: true}),
    attempt: DS.belongsTo('attempt', {async: true}),
    question: DS.belongsTo('question', {async: true}),
    value: DS.attr('number'),
    location: DS.attr('parse-geo-point')
});
