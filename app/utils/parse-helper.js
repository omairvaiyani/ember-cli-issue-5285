import StringHelper from '../utils/string-helper';

export default {
    generatePointer: function (object, className) {
        if (!className)
            className = object.constructor.typeKey;
        if (className === "parseUser")
            className = "_User";
        return {
            "__type": "Pointer",
            "className": StringHelper.upperCaseFirst(className),
            "objectId": object.get('id')
        }
    },
    generatePointerFromIdAndClass: function (objectId, className) {
        if (!objectId || !className)
            return;
        if (className === "parseUser")
            className = "_User";
        return {
            "__type": "Pointer",
            "className": StringHelper.upperCaseFirst(className),
            "objectId": objectId
        }
    },
    generatePointers: function (array) {
        var pointers = [];
        array.forEach(function (object) {
            pointers.push(this.generatePointer(object));
        }.bind(this));
        return pointers;
    },

    generatePointerFromNativeParse: function (object) {
        var className = object.className,
            id = object.id;

        if (!id)
            id = object.get('id');
        if (!id)
            id = object.getObjectId();
        return {
            "__type": "Pointer",
            "className": StringHelper.upperCaseFirst(className),
            "objectId": id
        }
    },

    generateSearchTags: function (searchTerm) {
        return _.filter(searchTerm.toLowerCase().split(' '), function (w) {
            return w.match(/^\w+$/) && !_.contains(this.stopWords, w);
        }.bind(this));
    },

    stopWords: ["the", "in", "and", "test", "mcqs", "of", "a", "an"],

    /**
     * @param {Parse.User} user
     */
    getUserProfileImageUrl: function (user) {
        if (!user)
            return "https://d3uzzgmigql815.cloudfront.net/img/silhouette.png";

        if (user.get('profilePicture')) {
            return this.getSecureParseUrl(user.get('profilePicture').get('url'));
        } else if (user.get('fbid')) {
            return "https://graph.facebook.com/" + user.get('fbid') + "/picture?height=250&type=square";
        } else {
            return "https://d3uzzgmigql815.cloudfront.net/img/silhouette.png";
        }
    },

    getSecureParseUrl: function (url) {
        if (url)
            return url._url.replace("http://", "https://s3.amazonaws.com/");
        else
            return "";
    },

    extractRawPayload: function (store, type, rawPayload, key) {
        var serializer = store.serializerFor(type),
            payload = rawPayload.result[key],
            originalPayload = $.extend(true, [], payload);

        _.each(payload, function (object) {
            object["id"] = object.objectId;
        });


        var serializedObjects = serializer.extractArray(store,
            store.modelFor(type), {results: payload});
        var loadedRecords = store.pushMany(store.modelFor(type), serializedObjects);

        var relationships = [];
        store.modelFor(type).eachRelationship(function (key, relationship) {
            relationships.push(relationship);
        });

        if (relationships.length) {
            // TODO replace hardcoded relationshipkey 'parent' with dynamic relationship.key
            loadedRecords.forEach(function (record, index) {
                if (!originalPayload[index].parent)
                    return;
                var serialisedRelationship = serializer.extractSingle(store,
                    store.modelFor(type), originalPayload[index].parent, originalPayload[index].parent.id);
                var loadedRelationship = store.pushMany(store.modelFor(type), [serialisedRelationship]);
                record.set('parent', loadedRelationship[0]);
            });
        }
        return loadedRecords;
    },

    extractRawCategories: function (store, rawPayload) {
        var loadedRecords = this.extractRawPayload(store, 'category', rawPayload, 'categories'),
            originalPayload = $.extend(true, [], rawPayload.result['categories']),
            serializer = store.serializerFor('category');

        loadedRecords.forEach(function (record, index) {
            if (!originalPayload[index].parent)
                return;
            var serialisedRelationship = serializer.extractSingle(store,
                store.modelFor('category'), originalPayload[index].parent, originalPayload[index].parent.id);
            var loadedRelationship = store.pushMany(store.modelFor('category'), [serialisedRelationship]);
            record.set('parent', loadedRelationship[0]);
        });
        return loadedRecords;
    },

    cloudFunction: function (context, functionName, params) {
        var adapter = context.store.adapterFor('application');
        return new Ember.RSVP.Promise(function (resolve, reject) {
            adapter.ajax("https://api.parse.com/1/functions/" + functionName, "POST", {data: params}).then(
                function (response) {
                    resolve(response.result);
                },
                function (reason) {
                    reject(reason.responseJSON);
                });
        });
    }

}
