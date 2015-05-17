import DS from 'ember-data';
import ParseMixin from '../mixins/ember-parse-mixin';
import CurrentUser from '../mixins/current-user';

export default DS.Model.extend(ParseMixin, CurrentUser, {
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
    isProfessional: DS.attr('boolean'),


    /**
     * @Property uniqueResponses
     * Locally set by filtering
     * currentUser.uniqueResponses
     * to questions in this test.
     */
    uniqueResponses: function () {
        return this.store.filter('unique-response', function (uniqueResponse) {
            return uniqueResponse.get('test.id') === this.get('id');
        }.bind(this));
    }.property('questions.length'),

    /**
     * @Property memoryStrength
     * Locally calculated by averaging
     * the memoryStrengths of this
     * tests.questions individual
     * uniqueResponses.
     */
    memoryStrength: function () {
        var totalMemoryCount = 0,
            memoryStrength;

        this.get('uniqueResponses').forEach(function (uniqueResponse) {
            totalMemoryCount += uniqueResponse.get('memoryStrength') ? uniqueResponse.get('memoryStrength') : 0;
        });

        if (totalMemoryCount > 0)
            memoryStrength = Math.floor(totalMemoryCount / this.get('uniqueResponses.length'));
        else
            memoryStrength = 0;

        return memoryStrength;
    }.property('uniqueResponses.@each.memoryStrength')
});
