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
    }.property( 'showDelete', 'showEdit', 'showShare', 'showSave', 'showRemove'),

    showProfilePicture: function () {
        return !this.get('test.isGenerated');
    }.property('test.isGenerated'),

    showMemoryStrength: function () {
        return !this.get('test.isGenerated');
    }.property('test.isGenerated'),

    showSRIcon: function () {
        return this.get('test.isSpacedRepetition');
    }.property('test.isSpacedRepetition'),

    showDelete: function () {
        return this.get('isCurrentUserTheAuthor') && !this.get('test.isGenerated');
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

    memoryStrengthMeterStyle: function () {
        var height = this.get('test.memoryStrength');
        return "height:" + height + "%;";
    }.property('memoryStrength'),

    memoryStrengthMeterInverseStyle: function () {
        var height = this.get('test.memoryStrength');
        return "height:" + (100 - height) + "%;";
    }.property('memoryStrength'),

    memoryStrengthSrc: function () {
        if (this.get('test.memoryStrength') === 100)
            return "/img/brain-bulb-small-gradient.png";
        else
            return "/img/brain-bulb-small-mask.png";
    }.property('test.memoryStrength'),

    actions: {
        deleteTest: function () {
            // TODO handle this properly
            //this.get('parentController').send('deleteTest', this.get('test'));
            this.get('test').destroyRecord();
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
