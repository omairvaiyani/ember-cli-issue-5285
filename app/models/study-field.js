import DS from 'ember-data';
import ParseMixin from '../mixins/ember-parse-mixin';

export default DS.Model.extend(ParseMixin, {
    name: DS.attr('string'),
    facebookId: DS.attr('string'),
    fbObject: DS.attr(),
    pictureUrl: DS.attr('string')
});
