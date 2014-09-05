import
DS
from
'ember-data';

export default
DS.Model.extend({
    from: DS.belongsTo('parse-user', {async: true}),
    to: DS.belongsTo('parse-user', {async: true}),
    message: DS.attr('string'),
    read: DS.attr('boolean'),
    type: DS.attr('string'),
    isAutomated: DS.attr('boolean'),
    test: DS.belongsTo('test', {async: true})
});
