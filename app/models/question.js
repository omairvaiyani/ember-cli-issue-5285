import DS from 'ember-data';

export default DS.Model.extend(ParseMixin, {
    stem: DS.attr('string', {defaultValue:""}),
    options: DS.attr(),
    areOptionsDirty: DS.attr('boolean', {defaultValue: false}),
    image: DS.attr(),
    feedback: DS.attr('string'),
    numberOfTimesTaken: DS.attr('number'),
    numberAnsweredCorrectly: DS.attr('number'),
    quality: DS.attr('number'),
    difficulty: DS.attr('number'),
    tags: DS.attr(),
    parseClassName: function() {
        return "Question";
    }
});
