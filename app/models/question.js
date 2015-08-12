import DS from 'ember-data';
import ParseMixin from '../mixins/ember-parse-mixin';

export default DS.Model.extend(ParseMixin, {
    stem: DS.attr('string', {defaultValue:""}),
    options: DS.attr(),
    areOptionsDirty: false,
    image: DS.attr('parse-file'),
    feedback: DS.attr('string'),
    numberOfTimesTaken: DS.attr('number'),
    numberAnsweredCorrectly: DS.attr('number'),
    quality: DS.attr('number'),
    difficulty: DS.attr('number'),
    tags: DS.attr(),
    isPublic: DS.attr('boolean'),

    parseClassName: function() {
        return "Question";
    }
});
