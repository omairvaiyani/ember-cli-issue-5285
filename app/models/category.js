import DS from 'ember-data';
import ParseMixin from '../mixins/ember-parse-mixin';

export default DS.Model.extend(ParseMixin, {
    level: DS.attr('number'),
    name: DS.attr('string'),
    parent: DS.belongsTo('category', {async: true}),
    totalTests: DS.attr('number', {defaultValue: 0}),
    slug: DS.attr('string'),
    hasChildren: DS.attr('boolean'),
    secondaryName: DS.attr('string'),

    /**
     * @Property Distinct Name
     * Returns secondaryName OR
     * name OR
     * parent.secondaryName/Other OR
     * parent.name/Other
     * in that order of preference.
     */
    distinctName: function () {
        if(this.get('name') === 'Other') {
            var parentName =  Em.getWithDefault(this.get('parent'), 'secondaryName', this.get('parent.name'));
            return parentName + "/Other";
        } else {
            return Em.getWithDefault(this, 'secondaryName', this.get('name'));
        }
    }.property('name', 'secondaryName', 'parent.name', 'parent.secondaryName')
});
