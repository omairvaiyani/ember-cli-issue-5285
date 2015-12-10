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
    coverImage: DS.attr(),

    pageHeaderCoverImageStyle: function () {
        var coverImage = this.get('coverImage'),
            url,
            style;

        if (this.get('parent.coverImage.url'))
            coverImage = this.get('parent.coverImage');

        if(!coverImage || !coverImage.url)
            url = "https://s3-eu-west-1.amazonaws.com/synap-dev-assets/img/category-images/index-page-cover.jpg";
        else
            url = coverImage.url;
        style = "background-image: url("+ url+ ");";
        if(coverImage && coverImage.x)
            style += "background-position-x:"+coverImage.x + "%;";
        if(coverImage && coverImage.y)
            style += "background-position-y:"+coverImage.y + "%;";
        return style;
    }.property('coverImage.url.length', 'parent.coverImage.url.length'),

    /**
     * @Property Distinct Name
     * Returns secondaryName OR
     * name OR
     * parent.secondaryName/Other OR
     * parent.name/Other
     * in that order of preference.
     */
    distinctName: function () {
        if (this.get('name') === 'Other') {
            var parentName = Em.getWithDefault(this.get('parent'), 'secondaryName', this.get('parent.name'));
            return parentName + "/Other";
        } else {
            return Em.getWithDefault(this, 'secondaryName', this.get('name'));
        }
    }.property('name', 'secondaryName', 'parent.name', 'parent.secondaryName')
});
