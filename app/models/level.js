import DS from 'ember-data';
import ParseMixin from '../mixins/ember-parse-mixin';

export default DS.Model.extend(ParseMixin, {
    title: DS.attr('string'),
    number: DS.attr('number'),
    pointsRequired: DS.attr('number'),
    pointsToLevelUp: DS.attr('number'),
    icon: DS.attr('parse-file'),
    description: DS.attr('description'),
    pointsRequiredForNextLevel: function () {
        return this.get('pointsRequired') + this.get('pointsToLevelUp');
    }.property('pointsRequired', 'pointsToLevelUp')
});
