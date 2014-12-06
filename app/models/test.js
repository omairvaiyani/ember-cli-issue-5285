import DS from 'ember-data';

import
ParseMixin
from
'../mixins/ember-parse-mixin';

export default DS.Model.extend(ParseMixin, {
    title: DS.attr('string'),
    author: DS.belongsTo('parse-user', {defaultValue: null, async: true}),
    category: DS.belongsTo('category', {defaultValue: null, async: true}),
    description: DS.attr('string'),
    questions: DS.hasMany('question', {async: true, array: true}),
    privacy: DS.attr('number', {defaultValue: 1}),
    privacyBoolean: function () {
        return !!this.get('privacy');
    }.property('privacy'),
    isActive: DS.attr('boolean'),
    isGenerated: DS.attr('boolean'),
    isPremium: DS.attr('boolean'),
    difficulty: DS.attr('number'),
    quality: DS.attr('number'),
    averageScore: DS.attr('number'),
    numberOfAttempts: DS.attr('number'),
    questionsPerAttempt: DS.attr('number'),
    bestAttempt: DS.belongsTo('attempt'),
    cumulativeScore: DS.attr('number'),
    numberOfUniqueAttempts: DS.attr('number'),
    uniqueAverageScore: DS.attr('number', {defaultValue:0}),
    module: DS.belongsTo('module'),
    tags: DS.attr(),
    slug: DS.attr('string'),
    isObjectDeleted: DS.attr('boolean'),
    isSpacedRepetition: DS.attr('boolean'),
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
    }.property()
});
