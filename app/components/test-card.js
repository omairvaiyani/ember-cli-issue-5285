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
        if(!this.get('parentController.currentUser'))
            return false;
        return !this.get('isCurrentUserTheAuthor')
            && this.get('parentController.currentUser.savedTests').contains(this.get('test'));
    }.property('isCurrentUserTheAuthor', 'parentController.currentUser.savedTests.length'),

    actions: {
        deleteTest: function () {
            this.get('parentController').send('deleteTest', this.get('test'));
        },

        saveTest: function () {
            this.get('parentController').send('saveCommunityTest', this.get('test'));
        },

        removeTest: function () {
            this.get('parentController').send('removeCommunityTest', this.get('test'));
        },

        openModal: function () {
            this.get('parentController').send('openModal', 'browse/modal/test-info', 'browse.modal.testInfo',
                this.get('test'));
        }
    }
});
