import DS from 'ember-data';
import ParseMixin from '../mixins/ember-parse-mixin';

export default DS.Model.extend(ParseMixin, {
    liker: DS.belongsTo('parse-user', {async: true}),
    activityId: DS.attr('string'),
    activityActor: DS.belongsTo('parse-user', {async: true}),
    activityType: DS.attr('string'),
    attempt: DS.belongsTo('attempt', {async: true}),
    test: DS.belongsTo('test', {async: true}),
    user: DS.belongsTo('parse-user', {async: true}),
    follow: DS.belongsTo('follow', {async: true})
});
