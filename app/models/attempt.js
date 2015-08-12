import DS from 'ember-data';
import ParseMixin from '../mixins/ember-parse-mixin';

export default DS.Model.extend(ParseMixin, {
    user: DS.belongsTo('parse-user', {async: true}),
    test: DS.belongsTo('test', {async: true}),
    questions: DS.hasMany('question', {async: true, array: true}),
    responses: DS.hasMany('response', {async: true, array: true}),
    score: DS.attr('number'),
    timeStarted: DS.attr('date'),
    timeCompleted: DS.attr('date'),
    isSpacedRepetition: DS.attr('boolean'),
    // @Deprecated
    parseClassName: function () {
        return "Attempt";
    }
});
