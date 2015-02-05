import DS from 'ember-data';
import ParseMixin from '../mixins/ember-parse-mixin';

export default DS.Model.extend(ParseMixin, {
    from: DS.belongsTo('parse-user', {async: true}),
    to: DS.belongsTo('parse-user', {async: true}),
    message: DS.attr('string'),
    read: DS.attr('boolean'),
    type: DS.attr('string'),
    isAutomated: DS.attr('boolean'),
    test: DS.belongsTo('test', {async: true}),
    attempt: DS.belongsTo('attempt', {async: true}),
    group: DS.belongsTo('group', {async: true})
});
