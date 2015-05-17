import DS from 'ember-data';
import EmberParseMixin from '../mixins/ember-parse-mixin';

export default DS.Model.extend(EmberParseMixin, {
    test: DS.belongsTo('test', {async:true}),
    question: DS.belongsTo('question', {async:true}),
    latestResponse: DS.belongsTo('response', {async:true}),
    numberOfResponses: DS.attr('number'),
    numberOfCorrectResponses: DS.attr('number'),
    latestResponseDate: DS.attr('parse-date'),
    latestResponseIsCorrect: DS.attr('boolean'),
    responses: new Ember.A(),
    memoryStrength: DS.attr('number')
});
