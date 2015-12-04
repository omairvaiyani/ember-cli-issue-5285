import DS from 'ember-data';

export default DS.Model.extend({
    title: DS.attr('string'),
    description: DS.attr('string'),
    criteria: DS.attr(),
    icon: DS.attr('file'),
    levelIcons: DS.attr(),
    isExplicit: DS.attr('boolean'),
    isTImeSensitive: DS.attr('boolean'),
    eventToMonitor: DS.attr('string')
});
