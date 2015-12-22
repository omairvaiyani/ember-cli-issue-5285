import DS from 'ember-data';
import ParseMixin from '../mixins/ember-parse-mixin';

export default DS.Model.extend(ParseMixin, {
    stem: DS.attr('string', {defaultValue: ""}),
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
    furtherReadingMetaData: DS.attr(),

    numberOfUsedOptions: function () {
        return this.get('options').filter(function (option) {
            return option.phrase && option.phrase.length;
        }).get('length');
    }.property('options.@each.phrase.length'),

    isTrueFalse: function () {
        if (this.get('numberOfUsedOptions') === 2) {
            return _.contains(["true", "false"], this.get('options')[0].phrase.trim().toLowerCase()) &&
                _.contains(["true", "false"], this.get('options')[1].phrase.trim().toLowerCase());
        } else {
            return false;
        }
    }.property('options.@each.phrase.length'),

    parseClassName: function () {
        return "Question";
    }
});
