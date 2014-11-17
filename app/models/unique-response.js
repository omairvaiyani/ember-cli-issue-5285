import DS from 'ember-data';
import EmberParseMixin from '../mixins/ember-parse-mixin';

export default DS.Model.extend(EmberParseMixin, {
    user: DS.belongsTo('parse-user', {async:true}),
    question: DS.belongsTo('question', {async:true}),
    latestResponse: DS.belongsTo('response', {async:true}),
    numberOfResponses: DS.attr('number'),
    spacedRepetitionBox: DS.attr('number')
});
