import Ember from 'ember';
import CurrentUser from '../mixins/current-user';
import AutocompleteHelper from '../utils/autocomplete-helper';
import EventTracker from '../utils/event-tracker';

export default Ember.ObjectController.extend(CurrentUser, {
    needs: ['create', 'medical'],
    createController: function () {
        return this.get('controllers.create');
    }.property('controllers.create'),
    createControllerReady: function () {
        if (this.get('createController.model') !== null &&
            this.get('prepareCreateControllerForGroup')) {
            this.get('createController').set('selectedGroup', this.get('model'));
            this.get('createController').set('model.description', "Test for " + this.get('name'));
            this.set('prepareCreateControllerForGroup', false);
        }
    }.observes('createController.model', 'prepareCreateControllerForGroup'),
    /* Tests list */
    orderTestsBy: 'title',
    orderTypes: [
        {value: 'title', label: "by Title"},
        {value: 'createdAt', label: "by Date Created"}
    ],
    showAllTests: true,
    testsToShow: [
        {value: false, label: 'Show Group Tests only'},
        {value: true, label: 'Show All Tests'}
    ],

    testsList: function () {
        var testsList = new Ember.A();
        if (this.get('showAllTests')) {
            testsList.addObjects(this.get('gatheredTests'));
        }
        testsList.addObjects(this.get('groupTests'));
        return testsList.sortBy(this.get('orderTestsBy'));
    }.property('gatheredTests.length', 'groupTests.length', 'orderTestsBy', 'showAllTests'),

    /* Admin/Mod controls */
    /*
     * Safe enough for front-end
     * But any mod actions must be verified
     * on Cloud code.
     */
    hasModeratorAccess: function () {
        if (this.get('currentUser.id') === this.get('creator.id'))
            return true;
        else {
            var isAdminOrMod = false;
            this.get('moderators').forEach(function (moderator) {
                if (this.get('currentUser.id') === moderator.get('id'))
                    isAdminOrMod = true;
            }.bind(this));
            if (!isAdminOrMod) {
                this.get('admins').forEach(function (admin) {
                    if (this.get('currentUser.id') === admin.get('id'))
                        isAdminOrMod = true;
                }.bind(this));
            }
            return isAdminOrMod;
        }
    }.property('id.length', 'creator.id', 'currentUser.id'),

    canAddMembers: function () {
        if (!this.get('currentUser.groups'))
            return false;

        return this.get('hasModeratorAccess') || this.get('membersCanInvite') &&
            this.get('currentUser.groups').contains(this.get('model'));
    }.property('id.length', 'hasModeratorAccess', 'membersCanInvite', 'currentUser.groups.length'),

    canAddTestsToGroup: function () {
        if (!this.get('currentUser.groups'))
            return false;

        return this.get('hasModeratorAccess') || this.get('membersCanAddTests') &&
            this.get('currentUser.groups').contains(this.get('model'));
    }.property('id.length', 'hasModeratorAccess', 'membersCanAddTests', 'currentUser.groups.length'),

    privacyOptions: [
        {value: "open", label: "Open"},
        {value: "closed", label: "Closed"},
        {value: "secret", label: "Secret"}
    ],

    /* Members */
    membersPreview: Ember.A(), // No need to load all members
    getMembersPreview: function () {
        /*
         * Get 10 members to preview
         */
        if (!this.get('id') || !this.get('members.length'))
            this.set('moreMembersToShow', false);

        this.get('membersPreview').clear();
        this.get('membersPreview').addObjects(this.get('members').slice(0, 10));
    }.observes('id.length', 'members.length'),

    /* Add Members */
    suggestedMembers: new Ember.A(),
    selectedSuggestedMembers: new Ember.A(),
    suggestedMemberNameDidChange: function () {
        if (!this.get('suggestedMemberName.length'))
            return this.get('suggestedMembers').clear();

        var params = {
            q: this.get('suggestedMemberName').toLowerCase(),
            engine_key: "KpTvAqftjz7ZaGG7FPr7"
        };
        $.getJSON("https://api.swiftype.com/api/v1/public/engines/suggest.json", params)
            .done(
            function (data) {
                this.get('suggestedMembers').clear();
                var previousRecords = new Ember.A();
                previousRecords.addObjects(this.get('members'));
                previousRecords.addObjects(this.get('selectedSuggestedMembers'));
                var uniqueSuggestions = AutocompleteHelper.uniqueSuggestions(data.records.users,
                    previousRecords);
                this.get('suggestedMembers').addObjects(uniqueSuggestions);
            }.bind(this));
    },

    throttleSuggestMemberNameDidChange: function () {
        Ember.run.debounce(this, this.suggestedMemberNameDidChange, 200);
    }.observes("suggestedMemberName.length"),

    showJoinGroup: function () {
        if (!this.get('currentUser'))
            return;

        if (this.get('currentUser') && this.get('privacy') === "open") {
            return !this.get('currentUser.groups').contains(this.get('model'));
        } else
            return false;
    }.property('id.length', 'currentUser.groups.length'),

    showLeaveGroup: function () {
        if (!this.get('currentUser'))
            return;
        if (this.get('currentUser.groups').contains(this.get('model')) &&
            this.get('creator.id') !== this.get('currentUser.id')) {
            return true;
        } else
            return false;
    }.property('id.length', 'currentUser.groups.length'),

    /* Add Tests */
    suggestedTests: new Ember.A(),
    selectedSuggestedTests: new Ember.A(),
    suggestedTestTitleDidChange: function () {
        if (!this.get('suggestedTestTitle.length'))
            return this.get('suggestedTests').clear();

        var params = {
            q: this.get('suggestedTestTitle').toLowerCase(),
            engine_key: "KpTvAqftjz7ZaGG7FPr7"
        };
        $.getJSON("https://api.swiftype.com/api/v1/public/engines/suggest.json", params)
            .done(
            function (data) {
                this.get('suggestedTests').clear();
                var previousRecords = new Ember.A();
                previousRecords.addObjects(this.get('gatheredTests'));
                previousRecords.addObjects(this.get('selectedSuggestedTests'));
                var uniqueSuggestions = AutocompleteHelper.uniqueSuggestions(data.records.tests,
                    previousRecords);
                this.get('suggestedTests').addObjects(uniqueSuggestions);
            }.bind(this));
    },

    throttleSuggestTestTitleDidChange: function () {
        Ember.run.debounce(this, this.suggestedTestTitleDidChange, 200);
    }.observes("suggestedTestTitle.length"),

    isProfessionalBankAvailable: function () {
        var studyFieldName = this.get('educationCohort.studyField.name');
        if(!studyFieldName)
            return false;
        return studyFieldName.toLowerCase().indexOf("med");
    }.property('educationCohort.studyField.name'),

    actions: {
        /* Add/Remove Members */
        selectSuggestedMember: function (member) {
            this.get('selectedSuggestedMembers').pushObject(member);
            this.get('suggestedMembers').clear(); // Overcome de-bounce for better UX
            this.set('suggestedMemberName', '');
            Ember.$("#suggestedMemberName").focus(); // Focus back on the text input
        },
        unselectSuggestedMember: function (member) {
            this.get('selectedSuggestedMembers').removeObject(member);
            Ember.$("#suggestedMemberName").focus(); // Focus back on the text input
        },
        addMembersToGroup: function (callback) {
            var memberIds = [];
            this.get('selectedSuggestedMembers').forEach(function (member) {
                memberIds.push(member.external_id);
            });
            var promise = Parse.Cloud.run('addMembersToGroup', {
                groupId: this.get('id'),
                memberIds: memberIds
            });
            callback(promise);
            promise.then(function () {
                this.get('model').getMembers(this.store);
                // Allow user to see success text on the button
                // Then reset everything, close modal.
                setTimeout(function () {
                    this.get('selectedSuggestedMembers').clear();
                    this.set('suggestedMemberName', '');
                    this.send('closeModal');
                }.bind(this), 1000);
            }.bind(this));
        },

        removeMemberFromGroupPrompt: function (member) {
            var confirm = {
                controller: this,
                callbackAction: 'removeMemberFromGroup',
                positive: "Yes",
                negative: "Cancel",
                returnItem: member
            };
            this.send('addNotification', 'warning', 'Are you sure you want to remove this member?', '',
                confirm);
        },
        removeMemberFromGroup: function (isPositive, member) {
            if (!isPositive)
                return;
            var resetIndex = this.get('members').indexOf(member);
            this.get('members').removeObject(member);
            Parse.Cloud.run('removeMembersFromGroup',
                {groupId: this.get('id'), memberIds: [member.get('id')]})
                .then(function () {

                }.bind(this),
                function (error) {
                    this.send('addNotification', 'warning', 'Member could not be removed!', error.message);
                    this.get('members').insertAt(resetIndex, member);
                }.bind(this));
        },

        joinGroup: function (callback) {
            var promise = Parse.Cloud.run('addMembersToGroup', {
                groupId: this.get('id'),
                memberIds: [this.get('currentUser.id')]
            });
            callback(promise);
            promise.then(function () {
                if (!this.get('members').contains(this.get('currentUser')))
                    this.get('members').pushObject(this.get('currentUser'));
                if (!this.get('currentUser.groups').contains(this.get('model')))
                    this.get('currentUser.groups').pushObject(this.get('model'));
                this.send('addNotification', 'success', "You have joined this group!");
            }.bind(this));
        },

        leaveGroup: function (callback) {
            var promise = Parse.Cloud.run('removeMembersFromGroup', {
                groupId: this.get('id'),
                memberIds: [this.get('currentUser.id')]
            });
            callback(promise);
            promise.then(function () {
                if (this.get('members').contains(this.get('currentUser')))
                    this.get('members').removeObject(this.get('currentUser'));
                if (this.get('currentUser.groups').contains(this.get('model')))
                    this.get('currentUser.groups').removeObject(this.get('model'));
                this.send('addNotification', 'delete', "You have left this group!");
            }.bind(this));
        },

        /* Add/Remove Tests */
        openAddTestsModal: function () {
            /*
             * Usually done directly from handlebars
             * But needed for the simple list-empty component action
             */
            this.send('openModal', 'group/modal/add-tests', 'group')
        },
        createAGroupTest: function () {
            this.transitionToRoute('create');
            this.set('prepareCreateControllerForGroup', true);
        },
        selectSuggestedTest: function (test) {
            this.get('selectedSuggestedTests').pushObject(test);
            this.get('suggestedTests').clear(); // Overcome de-bounce for better UX
            this.set('suggestedTestTitle', '');
            Ember.$("#suggestedTestTitle").focus(); // Focus back on the text input
        },
        unselectSuggestedTest: function (test) {
            this.get('selectedSuggestedTests').removeObject(test);
            Ember.$("#suggestedTestTitle").focus(); // Focus back on the text input
        },
        addTestsToGroup: function (callback) {
            var testIds = [];
            this.get('selectedSuggestedTests').forEach(function (test) {
                testIds.push(test.external_id);
            });
            var promise = Parse.Cloud.run('addTestsToGroup', {
                groupId: this.get('id'),
                testIds: testIds
            });
            callback(promise);
            promise.then(function () {
                // Allow user to see success text on the button
                // Then reset everything, close modal.
                setTimeout(function () {
                    this.get('selectedSuggestedTests').clear();
                    this.set('suggestedTestTitle', '');
                    this.send('closeModal');
                }.bind(this), 1000);
                var where = {
                    'objectId': {
                        "$in": testIds
                    }
                };
                return this.store.findQuery('test', {where: JSON.stringify(where)});
            }.bind(this))
                .then(function (tests) {
                    this.get('gatheredTests').pushObjects(tests.get('content'));
                }.bind(this));
        },

        removeTestFromGroupPrompt: function (test) {
            var confirm = {
                controller: this,
                callbackAction: 'removeTestFromGroup',
                positive: "Yes",
                negative: "Cancel",
                returnItem: test
            };
            var isGroupTest = test.get('group.id') === this.get('id');
            if (isGroupTest)
                this.send('addNotification', 'warning', 'This will permanently delete this Group Test!', '',
                    confirm);
            else
                this.send('addNotification', 'warning', 'Are you sure you want to remove this Test?', '',
                    confirm);
        },

        removeTestFromGroup: function (isPositive, test) {
            if (!isPositive)
                return;
            var isGroupTest = test.get('group.id') === this.get('id'),
                resetIndex = this.get('gatheredTests').indexOf(test);
            if (isGroupTest)
                this.get('groupTests').removeObject(test);
            else
                this.get('gatheredTests').removeObject(test);
            Parse.Cloud.run('removeTestsFromGroup',
                {groupId: this.get('id'), testIds: [test.get('id')]})
                .then(function () {
                    if (isGroupTest) {
                        test.set('isObjectDeleted', true);
                        test.save();
                    }
                }.bind(this),
                function (error) {
                    this.send('addNotification', 'warning', 'Test could not be removed!', error.message);
                    if (isGroupTest)
                        this.get('groupTests').insertAt(resetIndex, test);
                    else
                        this.get('gatheredTests').insertAt(resetIndex, test);
                }.bind(this));
        },

        sendUserToGenerateTest: function () {
            this.get('controllers.medical').set('generateForGroup', this.get('model'));
            this.transitionToRoute('medical');
        }
    }
});
