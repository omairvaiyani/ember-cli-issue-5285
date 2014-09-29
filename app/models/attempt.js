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
    test: DS.belongsTo('test', {async: true}),
    questions: DS.hasMany('question', {async: true, array: true}),
    responses: DS.hasMany('response', {async: true, array: true}),
    score: DS.attr('number'),
    timeStarted: DS.attr('parse-date'),
    timeCompleted: DS.attr('parse-date'),
    isLatest: DS.attr('boolean'),
    location: DS.attr('string'),
    parseClassName: function() {
        return "Attempt";
    }
});
