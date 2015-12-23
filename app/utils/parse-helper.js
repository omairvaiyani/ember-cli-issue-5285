import StringHelper from '../utils/string-helper';

export default {
    generatePointer: function (object, className) {
        if (!object)
            return "";
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

    generatePointers: function (array) {
        var pointers = [];
        array.forEach(function (object) {
            pointers.push(this.generatePointer(object));
        }.bind(this));
        return pointers;
    },

    getSecureParseUrl: function (url) {
        if (url)
            return url._url.replace("http://", "https://s3.amazonaws.com/");
        else
            return "";
    },

    /**
     * @Function Cloud Function
     * @param context
     * @param functionName
     * @param params
     * @returns {Ember.RSVP.Promise}
     */
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

    /**
     * @Function Save All
     *
     * // TODO, currently only works for "Response" class
     *
     * @param context
     * @param {string} className eg. _User
     * @param {Ember.A<DS.Model>}records
     * @returns {Ember.RSVP.Promise}
     */
    saveAll: function (context, className, records) {
        var adapter = context.store.adapterFor('application'),
            batchOperations = [],
            _this = this;

        records.forEach(function (record) {
            var recordJSON = record.toJSON(),
                pointerFields = [];
            // Due to issues with pointer fields, this has to be done
            switch (className) {
                case "Response":
                    pointerFields.push({key: "question", class: "Question"});
                    pointerFields.push({key: "test", class: "Test"});
                    pointerFields.push({key: "user", class: "_User"});
                    break;
            }
            _.each(pointerFields, function (pointerField) {
                recordJSON[pointerField.key] = _this.generatePointer(record.get(pointerField.key), pointerField.class);
            });
            batchOperations.push({
                method: "POST",
                path: "/1/classes/" + className,
                body: recordJSON
            });
        });

        // TODO max limit is 50 operations, split into multiple

        return new Ember.RSVP.Promise(function (resolve, reject) {
            adapter.ajax("https://api.parse.com/1/batch/", "POST", {data: {requests: batchOperations}}).then(
                function (response) {
                    var rawPayload = [];
                    _.each(response, function (payload) {
                        rawPayload.push(payload.success);
                    });
                    var modelType = "parse-user";
                    if (className !== "_User")
                        modelType = className.dasherize();
                    resolve(_this.extractRawPayload(context.store, modelType, rawPayload));
                },
                function (reason) {
                    reject(reason.responseJSON);
                });
        });
    },

    /**
     * @Function Upload File
     * Needed as Parse.File.save will not work.
     * Check mixins/image-upload for use example.
     * @param context
     * @param {String} name
     * @param data
     * @returns {Ember.RSVP.Promise}
     */
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
     * @Function Find Query
     * This allows us to use include parameters
     * properly.
     * @param context
     * @param {String} type
     * @param {Object} params
     * @returns {Ember.RSVP.Promise}
     */
    findQuery: function (context, type, params) {
        var adapter = context.store.adapterFor('application'),
            className = Ember.String.capitalize(Ember.String.camelize(type));
        return new Ember.RSVP.Promise(function (resolve, reject) {
            adapter.ajax("https://api.parse.com/1/classes/" + className,
                "GET", {data: params}).then(
                function (response) {
                    var result = this.extractRawPayload(context.store, type, response.results);
                    resolve(result);
                }.bind(this),
                function (reason) {
                    reject(reason.responseJSON);
                });
        }.bind(this));
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
     * @param {Array || Object} payload
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
            object.id = object.objectId ? object.objectId : object.id;
            if (!object.id)
                object.id = object.objectID;
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
    },

    /**
     * @Function Handle User With Included Data
     *
     * @param store
     * @param {object} jsonUser
     */
    handleUserWithIncludedData: function (store, jsonUser) {
        var educationCohort,
            earnedBadges,
            badgeProgressions;

        // Education Cohort
        if (jsonUser.educationCohort) {
            educationCohort = this.extractRawPayload(store, 'education-cohort',
                _.clone(jsonUser.educationCohort));
        }

        // Badges
        if (jsonUser.earnedBadges) {
            earnedBadges = this.extractRawPayload(store, 'badge', _.clone(jsonUser.earnedBadges));
        }
        if (jsonUser.badgeProgressions) {
            badgeProgressions = this.extractRawPayload(store, 'badge-progress',
                _.clone(jsonUser.badgeProgressions));
        }

        // Level
        var level = this.extractRawPayload(store, 'level', _.clone(jsonUser.level));

        // User Object
        var user = this.extractRawPayload(store, 'parse-user', jsonUser);
        user.set('initialisedFor', true);

        if (educationCohort)
            user.set('educationCohort', educationCohort);
        if (earnedBadges)
            user.set('earnedBadges', earnedBadges);
        if (badgeProgressions)
            user.set('badgeProgressions', badgeProgressions);
        if (level)
            user.set('level', level);

        return user;
    },

    /**
     * @Function Handle Relational Data Response for User
     *
     * @param store
     * @param currentUser
     * @param response
     */
    handleRelationalDataResponseForUser: function (store, currentUser, response) {
        // Created Tests
        if (response.createdTests) {
            var createdTests = this.extractRawPayload(store, 'test', response.createdTests);
            currentUser.get('createdTests').clear();
            currentUser.get('createdTests').addObjects(createdTests);
        }
        // Saved Tests
        if (response.savedTests) {
            var savedTests = this.extractRawPayload(store, 'test', response.savedTests);
            currentUser.get('savedTests').clear();
            currentUser.get('savedTests').addObjects(savedTests);
        }
        // Followers
        if (response.followers) {
            var followers = this.extractRawPayload(store, 'parse-user',
                response.followers);
            currentUser.set('followers', new Ember.A());
            currentUser.get('followers').addObjects(followers);
        }
        // Following
        if (response.following) {
            var following = this.extractRawPayload(store, 'parse-user',
                response.following);
            currentUser.set('following', new Ember.A());
            currentUser.get('following').addObjects(following);
        }
        // Education Cohort
        if (response.educationCohort) {
            var educationCohort = this.extractRawPayload(store, 'education-cohort',
                _.clone(response.educationCohort));
            if (educationCohort)
                currentUser.set('educationCohort', educationCohort);
        }
    }

}
