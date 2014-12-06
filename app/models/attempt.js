import DS from 'ember-data';
import ParseMixin from '../mixins/ember-parse-mixin';

export default
    DS.Model.extend(ParseMixin, {
        user: DS.belongsTo('parse-user', {async: true, inverse: 'latestAttempts'}),
        test: DS.belongsTo('test', {async: true}),
        questions: DS.hasMany('question', {async: true, array: true}),
        responses: DS.hasMany('response', {async: true, array: true}),
        score: DS.attr('number'),
        timeStarted: DS.attr('parse-date'),
        timeCompleted: DS.attr('parse-date'),
        isLatest: DS.attr('boolean'),
        location: DS.attr('string'),
        isProcessed: DS.attr('boolean'),
        isSRSAttempt: DS.attr('boolean'),
        parseClassName: function () {
            return "Attempt";
        },
        testTitle: function () {
            if (this.get('_data.test._data.title'))
                return this.get('_data.test._data.title');
            else {
                if(!this.get('_data.test.id'))
                    return''
                this.store.findById('test', this.get('_data.test.id'))
                    .then(function (test) {
                        this.set('testTitle', test.get('title'));
                    }.bind(this));
            }
        }.property(),
        testSlug: function () {
            return this.get('_data.test._data.slug');
        }.property(),
        testAverageScore: function () {
            return this.get('_data.test._data.averageScore');
        }.property(),
        testCategoryName: function () {
            return this.get('_data.test._data.category.name');
        }.property(),
        testCategorySlug: function () {
            return this.get('_data.test._data.category.slug');
        }.property(),
        userProfileImageUrl: function () {
            return this.getUserProfileImageUrl('user');
        }.property(),
        userSlug: function () {
            return this.get('_data.user._data.slug');
        }.property(),
        totalQuestions: function () {
            return this.get('_data.questions.length');
        }.property()
    });
