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
    /* @Deprecated
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
     },*/
    generatePointers: function (array) {
        var pointers = [];
        array.forEach(function (object) {
            pointers.push(this.generatePointer(object));
        }.bind(this));
        return pointers;
    },

    // @Deprecated
    /*generatePointerFromNativeParse: function (object) {
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

     stopWords: ["the", "in", "and", "test", "mcqs", "of", "a", "an"],*/

    /**
     * @param {Parse.User} user
     * @Deprecated
     *//*
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
     },*/

    getSecureParseUrl: function (url) {
        if (url)
            return url._url.replace("http://", "https://s3.amazonaws.com/");
        else
            return "";
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
    },

    uploadFile: function (context, name, data) {
        var adapter = context.store.adapterFor('application');
        return new Ember.RSVP.Promise(function (resolve, reject) {
            adapter.ajax("https://api.parse.com/1/files/" + name, "POST", {"data": data}).then(
                function (response) {
                    resolve(response);
                },
                function (reason) {
                    reject(reason["responseJSON"]);
                });
        });
    },

    /**
     * @Function Extract Raw Payload
     *
     * Takes a restful response from Parse
     * and converts JSON objects to Ember
     * Records - subsequently pushing them
     * to the store (including embedded
     * records) and returning the single
     * or array of records.
     *
     * @param {DS.Store} store
     * @param {String} type e.g. 'test', 'parse-user'
     * @param {Array or Object} payload
     * @returns {*}
     */
    extractRawPayload: function (store, type, payload) {
        var serializer = store.serializerFor(type),
            originalPayload = $.extend(true, [], payload),
            singleRecord = Object.prototype.toString.call(payload) !== '[object Array]';

        // Convert a single record into an array to unify code
        if (singleRecord) {
            payload = [payload];
            // Original payload is needed to store embedded records
            originalPayload = [originalPayload];
        }
        // Ember uses 'id' as primaryKey.
        _.each(payload, function (object) {
            object["id"] = object.objectId;
        });


        var serializedObjects = serializer.extractArray(store,
            store.modelFor(type), {results: payload});
        // loadedRecords is the main records - everything after this
        // is for embedded records
        var loadedRecords = store.pushMany(store.modelFor(type), serializedObjects);

        // To find embedded records, we need to know the relationships
        // as defined in the DS.Model extensions
        var relationships = [];
        store.modelFor(type).eachRelationship(function (key, relationship) {
            relationships.push(relationship);
        });

        if (relationships.length) {
            /*
             * This allows us to load included/embedded
             * relations into the main record.
             */
            loadedRecords.forEach(function (record, index) {
                // For each main record, loop through the
                // record relationships
                _.each(relationships, function (relationship) {
                    // Check if relatedObject exists in the original payload
                    var relation = originalPayload[index][relationship.key];
                    if (!relation)
                        return;
                    if (relationship.kind === 'belongsTo') {
                        // check if the record is embedded or just a pointer
                        if (relation.__type === "Pointer")
                            return;
                        var serialisedRelation = serializer.extractArray(store,
                            relationship.type, {results: [relation]});

                        var relationType = relationship.type;
                        // This bit is a patch - not sure why the function
                        // store.pushMany() will accept relationship.parentType
                        // for all records but only relationship.type for test.author
                        // and test.category -_-
                        if (relationship.key === 'parent')
                            relationType = relationship.parentType;

                        var loadedRelation = store.pushMany(relationType, serialisedRelation);
                        record.set(relationship.key, loadedRelation[0]);

                    } else if (relationship.kind === 'hasMany' && relation.length) {
                        // check if the record is embedded or just a pointer
                        if (relation[0].__type === "Pointer")
                            return;
                        var serialisedRelations = serializer.extractArray(store,
                            relationship.type, {results: relation});
                        var loadedRelations = store.pushMany(relationship.type, serialisedRelations);
                        record.get(relationship.key).addObjects(loadedRelations);
                    }
                });
            });
        }
        if (singleRecord)
            return loadedRecords[0];
        else
            return loadedRecords;
    }

}
