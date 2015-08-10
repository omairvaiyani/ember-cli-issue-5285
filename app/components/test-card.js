import Ember from 'ember';

export default Ember.Component.extend({
    currentUser: function () {
        return this.get('parentController.currentUser');
    }.property('parentController.currentUser'),

    isCurrentUserTheAuthor: function () {
        return this.get('currentUser.id') === this.get('test.author.id');
    }.property('currentUser'),

    showMenuOverFlow: function () {
        return this.get('showDelete') || this.get('showEdit') || this.get('showShare') ||
            this.get('showSave') || this.get('showRemove');
    }.property('showDelete', 'showEdit', 'showShare', 'showSave', 'showRemove'),

    showProfilePicture: function () {
        return !this.get('test.isGenerated');
    }.property('test.isGenerated'),

    showMemoryStrength: function () {
        return !this.get('test.isGenerated');
    }.property('test.isGenerated'),

    showSRIcon: function () {
        return this.get('test.isSpacedRepetition');
    }.property('test.isSpacedRepetition'),

    /**
     * @Property Show Delete
     * True if:
     * - Test author is currentUser AND,
     * - Test is not generated AND,
     * - Parent Controller is not browseTests
     *
     * @returns {boolean}
     */
    showDelete: function () {
        return this.get('isCurrentUserTheAuthor') && !this.get('test.isGenerated') &&
            this.get('parentController.controllerId') !== "browseTests";
    }.property('isCurrentUserTheAuthor', 'test.isGenerated'),

    showEdit: function () {
        return this.get('isCurrentUserTheAuthor') && !this.get('test.isGenerated');
    }.property('isCurrentUserTheAuthor', 'test.isGenerated'),

    showShare: function () {
        return !this.get('isGenerated') && this.get('isPublic');
    }.property('test.isGenerated', 'test.isPublic'),

    /**
     * @Property Show Save
     * Only shows the 'Save' test menu item
     * if current user is not author and current
     * user has not already saved the test.
     */
    showSave: function () {
        return !this.get('isCurrentUserTheAuthor')
            && !this.get('isTestSaved') && !this.get('test.isGenerated');
    }.property('isCurrentUserTheAuthor', 'isTestSaved', 'test.isGenerated'),

    /**
     * @Property Show Remove
     * Only shows the 'Remove' test menu item
     * if current user is not author and current
     * user has saved the test.
     */
    showRemove: function () {
        return !this.get('isCurrentUserTheAuthor')
            && this.get('isTestSaved') && !this.get('test.isGenerated');
    }.property('isCurrentUserTheAuthor', 'isTestSaved', 'test.isGenerated'),

    /**
     * @Property Is Test Saved
     * Dictates the showSave and showRemove properties.
     */
    isTestSaved: function () {
        if (!this.get('parentController.currentUser'))
            return false;
        return !this.get('isCurrentUserTheAuthor')
            && this.get('parentController.currentUser.savedTests').contains(this.get('test'));
    }.property('isCurrentUserTheAuthor', 'parentController.currentUser.savedTests.length'),

    /**
     * @Observes Check if Memory Strength Data has been Fetched
     * This means we have no URs to calculate MS, and so far,
     * we have not made a call to CC to fetch URs or
     * estimate MS.
     */
    checkIfMemoryStrengthDataHasBeenFetched: function () {
        if (this.get('currentUser') && !this.get('test.memoryStrengthDataHasBeenFetched'))
            this.send('fetchMemoryStrengthData');
    }.observes('test.uniqueResponses.length'),

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
        },

        toggleTagFilter: function (tag) {
            this.get('parentController').send('toggleTagFilter', tag);
        },

        toggleCategoryFilter: function (category) {
            this.get('parentController').send('toggleCategoryFilter', category);
        },

        fetchMemoryStrengthData: function () {
            this.get('parentController').send('fetchMemoryStrengthDataForTest', this.get('test'));
        }
    }
});
