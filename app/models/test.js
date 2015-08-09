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
    oldId: DS.attr('string'),
    totalQuestions: DS.attr('number'),
    difficulty: DS.attr('number', {defaultValue: 50}),

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
    }.property(),

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
            memoryStrength = this.get('estimatedMemoryStrength');

        return memoryStrength;
    }.property('uniqueResponses.@each.memoryStrength', 'estimatedMemoryStrength'),

    /**
     * @Property Estimated Memory Strength
     * This is calculated without URs,
     * and is done by way of CC function.
     * It is defaulted to 0 and set upon
     * CC response.
     */
    estimatedMemoryStrength: 0,

    /**
     * @Property Memory Strength Data has been Fetched
     * This is a temporarily computed-property.
     * If URs are found, it will automatically set to true.
     * Else, if CC has been checked for an estimate,
     * the CC callback function must override this
     * property to true - this will avoid further
     * fetching of test memory strength data until
     * the app reloads.
     */
    memoryStrengthDataHasBeenFetched: function () {
        return this.get('uniqueResponses.length') > 0;
    }.property('uniqueResponses.length'),

    memoryStrengthMeterStyle: function () {
        var height = this.get('memoryStrength');
        return "height:" + height + "%;";
    }.property('memoryStrength'),

    memoryStrengthMeterInverseStyle: function () {
        var height = this.get('memoryStrength');
        return "height:" + (100 - height) + "%;";
    }.property('memoryStrength'),

    memoryStrengthSrc: function () {
        if (this.get('memoryStrength') === 100)
            return "/img/brain-bulb-small-gradient.png";
        else
            return "/img/brain-bulb-small-mask.png";
    }.property('memoryStrength')

});
