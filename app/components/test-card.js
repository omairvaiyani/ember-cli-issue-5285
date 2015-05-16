import Ember from 'ember';

export default Ember.Component.extend({
    currentUser: function () {
        return this.get('parentController.currentUser');
    }.property('parentController.currentUser'),

    isCurrentUserTheAuthor: function () {
        return this.get('currentUser.id') === this.get('test.author.id');
    }.property('currentUser'),

    showDelete: function () {
        return this.get('isCurrentUserTheAuthor');
    }.property('isCurrentUserTheAuthor'),

    showEdit: function () {
        return this.get('isCurrentUserTheAuthor');
    }.property('isCurrentUserTheAuthor'),

    showShare: true,

    /**
     * @Property Show Save
     * Only shows the 'Save' test menu item
     * if current user is not author and current
     * user has not already saved the test.
     */
    showSave: function () {
        return !this.get('isCurrentUserTheAuthor')
            && !this.get('isTestSaved');
    }.property('isCurrentUserTheAuthor', 'isTestSaved'),

    /**
     * @Property Show Remove
     * Only shows the 'Remove' test menu item
     * if current user is not author and current
     * user has saved the test.
     */
    showRemove: function () {
        return !this.get('isCurrentUserTheAuthor')
            && this.get('isTestSaved');
    }.property('isCurrentUserTheAuthor', 'isTestSaved'),

    /**
     * @Property Is Test Saved
     * Dictates the showSave and showRemove properties.
     */
    isTestSaved: function () {
        return !this.get('isCurrentUserTheAuthor')
            && this.get('parentController.currentUser.savedTests').contains(this.get('test'));
    }.property('isCurrentUserTheAuthor', 'parentController.currentUser.savedTests.length'),

    /**
     * @Property Unique Responses
     * Filters the current user's uniqueResponses
     * for this particular test.
     */
    uniqueResponses: function () {
        this.set('a', this.get('a') + 1);
        if (!this.get('currentUser'))
            return 0;

        var uniqueResponses = this.get('currentUser.uniqueResponses').filter(function (uniqueResponse) {
            return uniqueResponse.get('test.id') === this.get('test.id');
        }.bind(this));

        return uniqueResponses;
    }.property('currentUser.uniqueResponses.length', 'test.questions.length'),

    actions: {
        deleteTest: function () {
            this.get('parentController').send('deleteTest', this.get('test'));
        },

        saveTest: function () {
            this.get('parentController').send('saveCommunityTest', this.get('test'));
        },

        removeTest: function () {
            this.get('parentController').send('removeCommunityTest', this.get('test'));
        }
    }
});
