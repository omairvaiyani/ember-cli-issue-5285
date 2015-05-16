import DS from 'ember-data';
import ParseMixin from '../mixins/ember-parse-mixin';

export default DS.Model.extend(ParseMixin, {
    title: DS.attr('string'),
    author: DS.belongsTo('parse-user', {defaultValue: null, async: true}),
    category: DS.belongsTo('category', {defaultValue: null, async: true}),
    description: DS.attr('string'),
    questions: DS.hasMany('question', {async: true, array: true}),
    // privacy deprecated: use isPublic bool
    privacy: DS.attr('number', {defaultValue: 1}),
    privacyBoolean: function () {
        return !!this.get('privacy');
    }.property('privacy'),
    isPublic: DS.attr('boolean', {defaultValue: true}),
    isGenerated: DS.attr('boolean'),
    quality: DS.attr('number', {defaultValue: 0}),
    numberOfAttempts: DS.attr('number', {defaultValue: 0}),
    numberOfUniqueAttempts: DS.attr('number', {defaultValue: 0}),
    averageScore: DS.attr('number', {defaultValue: 0}),
    averageUniqueScore: DS.attr('number', {defaultValue: 0}),
    tags: DS.attr(),
    slug: DS.attr('string'),
    isObjectDeleted: DS.attr('boolean'),
    isSpacedRepetition: DS.attr('boolean'),
    isProfessional: DS.attr('boolean')/*,
     group: DS.belongsTo('group', {async: true}),
     parseClassName: function() {
     return "Test";
     },
     totalQuestions: function () {
     return this.get('_data.questions.length');
     }.property(),
     authorProfileImageUrl: function () {
     return this.getUserProfileImageUrl('author');
     }.property(),
     authorSlug: function () {
     return this.getIncludedProperty('author', 'slug');
     }.property(),
     categoryName: function () {
     var value = this.getIncludedProperty('category','name');
     if(value)
     return value;
     else {
     this.store.findById('category', this.getIncludedProperty('category','id'))
     .then(function (category) {
     this.set('categorySlug', category.get('slug'));
     this.set('categoryName', category.get('name'));
     }.bind(this));
     }
     }.property(),
     categorySlug: function () {
     return this.getIncludedProperty('category','slug');
     }.property(),
     categoryParentCategoryName: function () {
     var value = this.getIncludedProperty('category','name', 'parent');
     if(value)
     return value;
     else {
     this.store.findById('category', this.getIncludedProperty('category','id', 'parent'))
     .then(function (category) {
     this.set('categoryParentCategorySlug', category.get('slug'));
     this.set('categoryParentCategoryName', category.get('name'));
     }.bind(this));
     }
     }.property(),
     categoryParentCategorySlug: function () {
     return this.getIncludedProperty('category','slug', 'parent');
     }.property()*/
});
