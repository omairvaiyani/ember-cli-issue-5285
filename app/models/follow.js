import DS from 'ember-data';
import ParseMixin from '../mixins/ember-parse-mixin';

export default DS.Model.extend(ParseMixin, {
    user: DS.belongsTo('parse-user', {async: true}),
    following: DS.belongsTo('parse-user', {async: true})
});
