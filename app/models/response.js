import DS from 'ember-data';
import ParseMixin from '../mixins/ember-parse-mixin';

export default DS.Model.extend(ParseMixin, {
    //attempt: DS.belongsTo('attempt', {async: true}),
    question: DS.belongsTo('question', {async: true}),
    user: DS.belongsTo('parse-user', {async: true}),
    test: DS.belongsTo('test', {async: true}),
    chosenOptions: DS.attr(),
    correctOptions: DS.attr(),
    isCorrect: DS.attr('boolean'),
    parseClassName: function () {
        return "Response";
    }
});
