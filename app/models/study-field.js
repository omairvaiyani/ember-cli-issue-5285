import DS from 'ember-data';
import ParseMixin from '../mixins/ember-parse-mixin';

export default DS.Model.extend(ParseMixin, {
    name: DS.attr('string'),
    facebookId: DS.attr('string'),
    fbObject: DS.attr(),
    pictureUrl: DS.attr('string'),

    url: function () {
        if(this.get('fbObject.url'))
            return this.get('fbObject.url');
        else if (this.get('facebookId'))
            return "https://facebook.com/" + this.get('facebookId');
        else
            return "javascript:void(0)";
    }.property('facebookId', 'fbObject.url')
});
