import
ParseHelper
from
'../utils/parse-helper';

export default
{
    name: 'parse-user-reopen',
    after: 'parse-adapter',
    initialize :
    function () {
        EmberParseAdapter.ParseUser.reopenClass({
            /*
             * If sessionToken is found on localStorage,
             * fetch the user from Parse.
             */
            validateSessionToken: function (store, sessionToken) {
                if (Ember.isEmpty(this.typeKey)) {
                    throw new Error('Parse login must be called on a model fetched via store.modelFor');
                }
                var model = this;
                var adapter = store.adapterFor(model);
                adapter.headers['X-Parse-Session-Token'] = sessionToken;
                var serializer = store.serializerFor(model);
                return adapter.ajax(adapter.buildURL("users/me"), "GET", {data: {} }).then(
                    function (response) {
                        serializer.normalize(model, response);
                        var record = store.push(model, response);
                        return record;
                    },
                    function (response) {
                        return Ember.RSVP.reject(response.responseJSON);
                    }
                );
            },

            getFollowing: function (store, object) {
                var where = {
                    "$relatedTo": {
                        "object": ParseHelper.generatePointer(object),
                        "key": "following"
                    }
                };
                return store.findQuery('parse-user', {where: JSON.stringify(where)})
                    .then(function(following) {
                       object.set('following', following);
                       return following;
                    });
            }

        });
    }
};
