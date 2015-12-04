import DS from 'ember-data';
import ParseMixin from '../mixins/ember-parse-mixin';

export default DS.Model.extend(ParseMixin, {
    badge: DS.belongsTo('badge', {async: true}),
    tally: DS.attr('number', {defaultValue: 0}),
    badgeLevel: DS.attr('number', {defaultValue: 1}),
    currentLevelProgress: DS.attr('number', {defaultValue: 0}),
    isUnlocked: DS.attr('boolean')
});
