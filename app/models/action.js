import DS from 'ember-data';
import ParseMixin from '../mixins/ember-parse-mixin';

export default DS.Model.extend(ParseMixin, {
    user: DS.belongsTo('parse-user', {async: true}),
    type: DS.attr('string'),
    test: DS.belongsTo('test', {async: true}),
    attempt: DS.belongsTo('attempt', {async: true}),
    question: DS.belongsTo('question', {async: true}),
    value: DS.attr('number'),
    location: DS.attr('parse-geo-point'),
    userSlug: function () {
        return this.getIncludedProperty('user', 'slug');
    }.property(),
    userName: function () {
        return this.getIncludedProperty('user', 'name');
    }.property(),
    userProfileImageUrl: function () {
        return this.getUserProfileImageUrl('user');
    }.property(),
    testTitle: function () {
        if (this.getIncludedProperty('test', 'title'))
            return this.getIncludedProperty('test', 'title');
        else {
            if (!this.get('_data.test.id'))
                return ''
            this.store.findById('test', this.get('_data.test.id'))
                .then(function (test) {
                    this.set('testTitle', test.get('title'));
                }.bind(this));
        }
    }.property(),
    testSlug: function () {
        return this.getIncludedProperty('test', 'slug');
    }.property(),
    testCategoryName: function () {
        var value = this.getIncludedProperty('category', 'name', 'test');
        if (value)
            return value;
        else {
            this.store.findById('category', this.getIncludedProperty('category', 'id', 'test'))
                .then(function (category) {
                    this.set('testCategorySlug', category.get('slug'));
                    this.set('testCategoryName', category.get('name'));
                }.bind(this));
        }
    }.property(),
    testCategorySlug: function () {
        return this.getIncludedProperty('category', 'slug', 'test');
    }.property()
});
