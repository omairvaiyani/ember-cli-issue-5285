import Ember from 'ember';
import CurrentUser from '../mixins/current-user';

export default Ember.ObjectController.extend(CurrentUser, {
    /* Admin/Mod controls */
    hasModeratorAccess: function () {
        if(this.get('currentUser.id') === this.get('creator.id'))
            return true;
        else
            return false;
    }.property('creator.id', 'currentUser.id'),

    /* Group relations */
    membersPreview: Ember.A(), // No need to load all members
    getMembersPreview: function () {
        /*
         * Get 10 members to preview
         */
        if (!this.get('id'))
            return;
        var group = new Parse.Object('Group');
        group.id = this.get('model.id');
        group.fetch()
            .then(function () {
                var members = group.relation('members');
                var query = members.query();
                query.limit(10);
                return query.find();
            }).then(function (members) {
                var memberIds = [];
                for (var i = 0; i < members.length; i++) {
                    memberIds.push(members[i].id);
                }
                var where = {
                    "objectId": {
                        "$in": memberIds
                    }
                };
                return this.store.findQuery('parse-user', {where: JSON.stringify(where)});
            }.bind(this))
            .then(function (membersPreview) {
                this.get('membersPreview').addObjects(membersPreview);
            }.bind(this));
    }.observes('id.length'),

    /* Add Members*/
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
                this.get('suggestedMembers').addObjects(data.records.users.slice(0, 5));
            }.bind(this));
    },

    throttleSuggestMemberNameDidChange: function () {
        Ember.run.debounce(this, this.suggestedMemberNameDidChange, 200);
    }.observes("suggestedMemberName.length"),

    actions: {
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
        addMembersToGroup: function () {
            var memberIds = [];
            this.get('selectedSuggestedMembers').forEach(function (member) {
                memberIds.push(member.external_id);
            });
            Parse.Cloud.run('addMembersToGroup', {
                groupId: this.get('id'),
                memberIds: memberIds
            }).then(function (response) {
                    console.dir(response);
                }.bind(this),
                function (error) {
                    console.dir(error);
                });
        }
    }
});
