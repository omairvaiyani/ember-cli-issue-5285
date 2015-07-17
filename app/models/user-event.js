import DS from 'ember-data';
import EmberParseMixin from '../mixins/ember-parse-mixin';

export default DS.Model.extend(EmberParseMixin, {
    type: DS.attr('string'),
    objects: DS.attr(),
    objectTypes: DS.attr(),
    pointsTransacted: DS.attr('number'),
    label: function () {
        return Ember.String.decamelize(this.get('type')).replace("_", " ").capitalize();
    }.property('type')
});
