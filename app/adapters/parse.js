import DS from 'ember-data';

var EmberParseAdapter = {};
EmberParseAdapter.Transforms = {};

/*
 Serializer to assure proper Parse-to-Ember encodings
 */
EmberParseAdapter.Serializer = DS.RESTSerializer.extend({

    primaryKey: "objectId",

    extractArray: function (store, primaryType, payload) {
        var namespacedPayload = {};

        /*if (primaryType == "mycqs-web@model:attempt:") {
            var results = payload.results,
                normalizedSubrecords = [];
            store.modelFor(primaryType).eachRelatedType(function (relation) {
                if (relation.typeKey === "test") {
                    for (var i = 0; i < results.length; i++) {
                        var primaryRecord = results[i];
                        var subRecord = primaryRecord[relation.typeKey];
                        *//*for (var j = 0; j < subRecords.length; j++) {
                         var subRecord = subRecords[j];
                         console.log("SUBRECORD");
                         console.dir(subRecord);
                         var normalizedSubRecord = this.extractSingle(store, relation, subRecord);
                         normalizedSubrecords.push(normalizedSubRecord);
                         }*//*
                        if(subRecord) {
                            console.log("Attempt . test");
                            var normalizedSubRecord = this.extractSingle(store, relation, subRecord, subRecord.objectId);
                            normalizedSubrecords.push(normalizedSubRecord);
                        }
                    }
                }
            }.bind(this));
        }*/

        namespacedPayload[Ember.String.pluralize(primaryType.typeKey)] = payload.results;
        var primaryArray = this._super(store, primaryType, namespacedPayload);
        return primaryArray;
    },


    extractSingle: function (store, primaryType, payload, recordId) {
        var namespacedPayload = {};
        namespacedPayload[primaryType.typeKey] = payload; // this.normalize(primaryType, payload);
        var normalizedPayload = this._super(store, primaryType, namespacedPayload, recordId);
        return normalizedPayload;
    },

    typeForRoot: function (key) {
        return Ember.String.dasherize(Ember.String.singularize(key));
    },

    /**
     * Because Parse only returns the updatedAt/createdAt values on updates
     * we have to intercept it here to assure that the adapter knows which
     * record ID we are dealing with (using the primaryKey).
     */
    extract: function (store, type, payload, id, requestType) {
        if (id !== null && (requestType === "updateRecord" || requestType === "deleteRecord")) {
            payload[this.get('primaryKey')] = id;
        }
        return this._super(store, type, payload, id, requestType);
    },

    /**
     * Extracts count from the payload so that you can get the total number
     * of records in Parse if you're using skip and limit.
     */
    extractMeta: function (store, type, payload) {
        if (payload && payload.count) {
            store.metaForType(type, {count: payload.count});
            delete payload.count;
        }
    },

    /**
     * Special handling for the Date objects inside the properties of
     * Parse responses.
     */
    normalizeAttributes: function (type, hash) {
        type.eachAttribute(function (key, meta) {
            if (meta.type === "date" && Ember.typeOf(hash[key]) === "object" && hash[key].iso) {
                hash[key] = hash[key].iso; //new Date(hash[key].iso).toISOString();
            }
        });
        this._super(type, hash);
    },

    /**
     * Special handling of the Parse relation types. In certain
     * conditions there is a secondary query to retrieve the "many"
     * side of the "hasMany".
     */
    normalizeRelationships: function (type, hash) {
        var store = this.get('store');
        var serializer = this;

        type.eachRelationship(function (key, relationship) {

            var options = relationship.options;

            // Handle the belongsTo relationships
            if (hash[key] && relationship.kind === 'belongsTo') {
                hash[key] = hash[key].objectId;
            }

            // Handle the hasMany relationships
            if (hash[key] && relationship.kind === 'hasMany') {

                // If this is a Relation hasMany then we need to supply
                // the links property so the adapter can async call the
                // relationship.
                // The adapter findHasMany has been overridden to make use of this.
                if (options.relation) {
                    hash.links = {};
                    hash.links[key] = {type: relationship.type, key: key};
                }

                if (options.array) {
                    // Parse will return [null] for empty relationships
                    if (hash[key].length && hash[key]) {
                        hash[key].forEach(function (item, index, items) {
                            // When items are pointers we just need the id
                            // This occurs when request was made without the include query param.
                            /*
                             * Modified by Omair:
                             * - check if item exists
                             */
                            if (item && item.__type === "Pointer") {
                                items[index] = item.objectId;
                            } else if (item) {
                                // When items are objects we need to clean them and add them to the store.
                                // This occurs when request was made with the include query param.
                                delete item.__type;
                                delete item.className;
                                item.id = item.objectId;
                                delete item.objectId;
                                item.type = relationship.type;
                                serializer.normalizeAttributes(relationship.type, item);
                                serializer.normalizeRelationships(relationship.type, item);
                                store.push(relationship.type, item);
                            }
                        });
                    }
                }

            }
        }, this);

        this._super(type, hash);
    },

    serializeIntoHash: function (hash, type, record, options) {
        Ember.merge(hash, this.serialize(record, options));
    },

    serializeAttribute: function (record, json, key, attribute) {
        // These are Parse reserved properties and we won't send them.
        if (key === 'createdAt' ||
            key === 'updatedAt' ||
            key === 'emailVerified' ||
            key === 'sessionToken') {
            delete json[key];
        } else {
            this._super(record, json, key, attribute);
        }
    },
    serializeBelongsTo: function (record, json, relationship) {
        var key = relationship.key;
        var belongsTo = record.get(key);
        if (belongsTo) {
            /*
             * Modified by Omair
             * Sometimes .belongsTo was invalid
             * Instead, record._relationships[key].inverseRecord
             * was pointing to the object. Bizarre, but a
             * workaround.
             */
            if (!belongsTo.constructor || !belongsTo.get('content')) {
                if (!record._relationships[key])
                    belongsTo = record.get(key).get('content');
                else
                    belongsTo = record._relationships[key].inverseRecord;
                if (!belongsTo)
                    return;
            } else
                belongsTo = belongsTo.get('content');

            json[key] = {
                "__type": "Pointer",
                "className": this.parseClassName(belongsTo.constructor.typeKey),
                "objectId": belongsTo.get('id')
            };
        }
    },
    /*
     * Modified by Omair:
     * - Added 'user' to match key
     */
    parseClassName: function (key) {
        if (key === "parseUser" || key === "user") {
            return "_User";
        } else {
            return Ember.String.capitalize(Ember.String.camelize(key));
        }
    },

    /*
     * Modified by Omair:
     * - Changed json[key] to an array to match Parse REST API
     */
    serializeHasMany: function (record, json, relationship) {
        var key = relationship.key;
        var hasMany = record.get(key);
        var options = relationship.options;
        if (hasMany && hasMany.get('length') > 0) {

            // json[key] = { "objects": [] };
            // OMAIR edit, "objects" is not what Parse REST api expects
            json[key] = [];

            if (options.relation) {
                json[key].__op = "AddRelation";
            }

            if (options.array) {
                json[key].__op = "AddUnique";
            }

            hasMany.forEach(function (child) {
                /*
                 * Old code

                 json[key].objects.push({
                 "__type": "Pointer",
                 "className": child.parseClassName(),
                 "objectId": child.get('id')
                 });
                 *
                 */
                /*
                 * Modified by Omair:
                 * - User json[key] directly, instead of through the objects param
                 */
                json[key].push({
                    "__type": "Pointer",
                    "className": child.parseClassName(),
                    "objectId": child.get('id')
                });
            });

            if (hasMany._deletedItems && hasMany._deletedItems.length) {
                if (options.relation) {
                    var addOperation = json[key];
                    var deleteOperation = {"__op": "RemoveRelation", "objects": []};
                    hasMany._deletedItems.forEach(function (item) {
                        deleteOperation.objects.push({
                            "__type": "Pointer",
                            "className": item.type,
                            "objectId": item.id
                        });
                    });
                    json[key] = {"__op": "Batch", "ops": [addOperation, deleteOperation]};
                }
                if (options.array) {
                    json[key].deleteds = {"__op": "Remove", "objects": []};
                    hasMany._deletedItems.forEach(function (item) {
                        json[key].deleteds.objects.push({
                            "__type": "Pointer",
                            "className": item.type,
                            "objectId": item.id
                        });
                    });
                }
            }
        } else {
            json[key] = [];
        }
    }
});

/**
 * An Ember Data Adapter written to use Parse REST API
 * @type {DS.RESTAdapter}
 */
EmberParseAdapter.Adapter = DS.RESTAdapter.extend({

    defaultSerializer: '-parse',

    init: function () {
        this._super();
        this.set('headers', {
            "X-Parse-Application-Id": this.get('applicationId'),
            "X-Parse-REST-API-Key": this.get('restApiId')
        });
    },

    host: "https://api.parse.com",
    namespace: '1',
    classesPath: 'classes',

    /*
     * Modified by Omair:
     * - Added 'users/me' check for session validation request
     * - Added 'signup' check and proper path for PARSE REST API
     * - Our PrivateData class should've been called PrivateDatum, but oh well.
     */
    pathForType: function (type) {
        if ("parseUser" === type) {
            return "users";
        } else if ("login" === type) {
            return "login";
        } else if ("signup" === type) {
            return "users";
        } else if ("users/me" === type) {
            return "users/me";
        } else {
            return this.classesPath + '/' + this.parsePathForType(type);
        }
    },

    // Using TitleStyle is recommended by Parse
    // TODO: test
    parsePathForType: function (type) {
        return Ember.String.capitalize(Ember.String.camelize(type));
    },

    /**
     * Because Parse doesn't return a full set of properties on the
     * responses to updates, we want to perform a merge of the response
     * properties onto existing data so that the record maintains
     * latest data.
     */
    createRecord: function (store, type, record) {
        var data = {};
        var serializer = store.serializerFor(type.typeKey);
        serializer.serializeIntoHash(data, type, record, {includeId: true});
        var adapter = this;
        return new Ember.RSVP.Promise(function (resolve, reject) {
            adapter.ajax(adapter.buildURL(type.typeKey), "POST", {data: data}).then(
                function (json) {
                    var completed = Ember.merge(data, json);
                    resolve(completed);
                },
                function (reason) {
                    reject(reason.responseJSON);
                });
        });
    },

    /**
     * Because Parse doesn't return a full set of properties on the
     * responses to updates, we want to perform a merge of the response
     * properties onto existing data so that the record maintains
     * latest data.
     */
    updateRecord: function (store, type, record) {
        var data = {};
        var deleteds = {};
        var sendDeletes = false;
        var serializer = store.serializerFor(type.typeKey);
        serializer.serializeIntoHash(data, type, record);
        var id = record.get('id');
        var adapter = this;

        type.eachRelationship(function (key, relationship) {
            if (data[key] && data[key].deleteds) {
                deleteds[key] = data[key].deleteds;
                delete data[key].deleteds;
                sendDeletes = true;
            }
        });

        return new Ember.RSVP.Promise(function (resolve, reject) {
            if (sendDeletes) {
                adapter.ajax(adapter.buildURL(type.typeKey, id), "PUT", {data: deleteds}).then(
                    function (json) {
                        adapter.ajax(adapter.buildURL(type.typeKey, id), "PUT", {data: data}).then(
                            function (updates) {
                                // This is the essential bit - merge response data onto existing data.
                                var completed = Ember.merge(data, updates);
                                resolve(completed);
                            },
                            function (reason) {
                                reject("Failed to save parent in relation: " + reason.response.JSON);
                            }
                        );
                    },
                    function (reason) {
                        reject(reason.responseJSON);
                    }
                );
            } else {
                adapter.ajax(adapter.buildURL(type.typeKey, id), "PUT", {data: data}).then(function (json) {
                    // This is the essential bit - merge response data onto existing data.
                    var completed = Ember.merge(data, json);
                    resolve(completed);
                }, function (reason) {
                    reject(reason.responseJSON);
                });
            }
        });
    },

    /*
     * Modified by Omair
     * converts parseUser key to _User
     */
    parseClassName: function (key) {
        if (key === 'parseUser')
            key = '_User';
        return Ember.String.capitalize(key);
    },

    /**
     * Implementation of a hasMany that provides a Relation query for Parse
     * objects.
     */
    findHasMany: function (store, record, relatedInfo) {
        /*
         * Modified by Omair
         * record.typeKey is sometimes undefined
         * but record.constructor.typeKey fixes
         * this issue.
         */
        if (!record.typeKey)
            record.typeKey = record.constructor.typeKey;
        var query = {
            where: {
                "$relatedTo": {
                    "object": {
                        "__type": "Pointer",
                        "className": this.parseClassName(record.typeKey),
                        "objectId": record.get('id')
                    },
                    key: relatedInfo.key
                }
            }
        };
        // the request is to the related type and not the type for the record.
        // the query is where there is a pointer to this record.
        return this.ajax(this.buildURL(relatedInfo.type.typeKey), "GET", {data: query});
    },

    /**
     * Implementation of findQuery that automatically wraps query in a
     * JSON string.
     *
     * @example
     *     this.store.find('comment', {
   *       where: {
   *         post: {
   *             "__type":  "Pointer",
   *             "className": "Post",
   *             "objectId": post.get('id')
   *         }
   *       }
   *     });
     */
    findQuery: function (store, type, query) {
        if (query.where && Ember.typeOf(query.where) !== 'string') {
            query.where = JSON.stringify(query.where);
        }

        // Pass to _super()
        return this._super(store, type, query);
    },

    /*
     * Added by Omair:
     * - Overriding 'findMany' from ember-data
     * - Using the correct Parse REST format for fetching multiple records by id
     */
    findMany: function (store, type, ids) {
        var where = JSON.stringify({
            "objectId": {
                "$in": ids
            }
        });
        return this.ajax(this.buildURL(type.typeKey), 'GET', {data: {"where": where}});
    },

    sessionToken: Ember.computed('headers.X-Parse-Session-Token', function (key, value) {
        if (arguments.length < 2) {
            return this.get('headers.X-Parse-Session-Token');
        } else {
            this.set('headers.X-Parse-Session-Token', value);
            return value;
        }
    })
});

/**
 * Parse User object implementation
 * @type {DS.ParseModel}
 */
EmberParseAdapter.ParseUser = DS.Model.extend({
    username: DS.attr('string'),
    password: DS.attr('string'),
    email: DS.attr('string'),
    emailVerified: DS.attr('boolean'),
    sessionToken: DS.attr('string'),

    createdAt: DS.attr('date'),
    updatedAt: DS.attr('date'),
    /*
     * Modified by Omair:
     * - Added MyCQs ParseUser attributes
     * - Extending or reopeninClass does
     * not seem to be working for now
     */
    name: DS.attr('string'),
    firstName: function () {
        if (this.get('name').split(' ')[1])
            return this.get('name').split(' ').slice(0, -1).join(' ');
        else
            return this.get('name');
    }.property('name'),
    fbid: DS.attr('string'),
    gender: DS.attr('string'),
    education: DS.attr(),
    course: DS.belongsTo('course', {async: true}),
    institution: DS.belongsTo('university', {async: true}),
    yearNumber: DS.attr('number'),
    profilePicture: DS.attr('parse-file'),
    profileImageURL: function () {
        if (this.get('profilePicture') && this.get('profilePicture.url')) {
            return this.get('profilePicture.secureUrl');
        } else if (this.get('fbid')) {
            return "https://res.cloudinary.com/mycqs/image/facebook/c_thumb,e_improve,g_faces:center,w_150/" + this.get('fbid');
        } else {
            return "https://d3uzzgmigql815.cloudfront.net/img/silhouette.png";
        }
    }.property('fbid', 'profilePicture'),

    coverImage: DS.attr('parse-file'),
    coverImageOffsetY: 50,
    coverImageURL: function () {
        if (this.get('coverImage') && this.get('coverImage.url')) {
            return this.get('coverImage.secureUrl');
        } else if (this.get('fbid')) {
            this.getFbCoverImage();
            return "";
        } else {
            return 'https://d3uzzgmigql815.cloudfront.net/img/coffee-revise.jpg';
        }
    }.property('fbid', 'coverImage'),
    getFbCoverImage: function () {
        $.getJSON("https://graph.facebook.com/" + this.get('fbid') + "?fields=cover")
            .then(function (data) {
                if (data) {
                    var cover = data.cover;
                    if (cover) {
                        if (cover.offset_y)
                            this.set('coverImageOffsetY', cover.offset_y);
                        this.set('coverImageURL', cover.source);
                    }
                }
            }.bind(this));
    },

    numberOfTests: DS.attr('number'),
    numberOfQuestions: DS.attr('number'),
    numberOfAttempts: DS.attr('number'),
    averageScore: DS.attr('number', {defaultValue: 0}),
    uniqueNumberOfAttempts: DS.attr('number', {defaultValue: 0}),
    uniqueAverageScore: DS.attr('number', {defaultValue: 0}),
    communityNumberOfAttempts: DS.attr('number', {defaultValue: 0}),
    communityAverageScore: DS.attr('number', {defaultValue: 0}),
    communityUniqueNumberOfAttempts: DS.attr('number', {defaultValue: 0}),
    communityUniqueAverageScore: DS.attr('number', {defaultValue: 0}),
    facebookFriends: DS.attr(),
    numberFollowing: DS.attr('number', {defaultValue: 0}),
    numberOfFollowers: DS.attr('number', {defaultValue: 0}),
    latestAttempts: DS.hasMany('attempt', {async: true, array: true}),
    slug: DS.attr('string'),
    finishedWelcomeTutorial: DS.attr('boolean'),

    timeZone: DS.attr('string'),
    privateData: DS.belongsTo('user-private', {async: true}),
    spacedRepetitionNotificationByEmail: DS.attr('boolean'),
    spacedRepetitionNotificationByPush: DS.attr('boolean'),
    spacedRepetitionMaxQuestions: DS.attr('number'),
    spacedRepetitionIntensity: DS.attr('number'),
    spacedRepetitionNextDue: DS.attr('parse-date'),
    latestSRSAttempt: DS.belongsTo('attempt', {async: true})
});

EmberParseAdapter.ParseUser.reopenClass({

    requestPasswordReset: function (email) {
        var adapter = this.get('store').adapterFor(this);
        var data = {email: email};
        return adapter.ajax(adapter.buildURL("requestPasswordReset"), "POST", {data: data})['catch'](
            function (response) {
                return Ember.RSVP.reject(response.responseJSON);
            }
        );
    },

    login: function (store, data) {
        if (Ember.isEmpty(this.typeKey)) {
            throw new Error('Parse login must be called on a model fetched via store.modelFor');
        }
        var model = this;
        var adapter = store.adapterFor(model);
        var serializer = store.serializerFor(model);
        return adapter.ajax(adapter.buildURL("login"), "GET", {data: data}).then(
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

    /*
     * Modified by Omair:
     * - Changed adapter.buildURL() to send "signup" as the param
     * - This is intercepted by pathForType, which is also modified by Omair
     */
    signup: function (store, data) {
        if (Ember.isEmpty(this.typeKey)) {
            throw new Error('Parse signup must be called on a model fetched via store.modelFor');
        }
        var model = this;
        var adapter = store.adapterFor(model);
        var serializer = store.serializerFor(model);
        return adapter.ajax(adapter.buildURL("signup"), "POST", {data: data}).then(
            function (response) {
                serializer.normalize(model, response);
                response.email = response.email || data.email;
                response.username = response.username || data.username;
                var record = store.push(model, response);
                return record;
            },
            function (response) {
                return Ember.RSVP.reject(response.responseJSON);
            }
        );
    }
});

EmberParseAdapter.GeoPoint = Ember.Object.extend({
    latitude: Ember.computed(function () {
        return this._latitude;
    }).readOnly(),
    longitude: Ember.computed(function () {
        return this._longitude;
    }).readOnly(),

    init: function (latitude, longitude) {
        this._latitude = latitude;
        this._longitude = longitude;
    }

});
/*
 * Modified by Omair
 * Added secureUrl for SSL
 */
EmberParseAdapter.File = Ember.Object.extend({
    name: Ember.computed(function () {
        return this._name;
    }).readOnly(),
    url: Ember.computed(function () {
        return this._url;
    }).readOnly(),
    secureUrl: Ember.computed(function () {
        return this._url.replace("http://", "https://s3.amazonaws.com/");
    }).readOnly(),

    init: function (name, url) {
        this._name = name;
        this._url = url;
    }

});

/*
 * The file transform handles Parse's custom GeoPoint format. For
 * example a Parse file might come back from the REST API
 * looking like this:
 *
 * "registeredAt": {
 *   "__type": "GeoPoint",
 *   "latitude": 45.2934237432,
 *   "longitude": -17.233242432
 * }
 *
 * This helper deserializes that structure into a special
 * EmberParseAdapter.GeoPoint object. This object should not be
 * changed, instead set a new file object to the property.
 *
 * this.store.find('model').then(function(model){
 *   model.get('someGeo'); // -> GeoPoint object
 *   model.get('someGeo.latitude'); // -> someGeo latitude
 *
 *   var geoPoint = new EmberParseAdapter.GeoPoint(lat, lon);
 *   model.set('someGeo', geoPoint);
 * });
 *
 * When saving a record, the EmberParseAdapter.GeoPoint object
 * is likewise serialized into the Parse REST API format.
 *
 * @class EmberParseAdapter.Transforms.GeoPoint
 */
EmberParseAdapter.Transforms.GeoPoint = DS.Transform.extend({

    deserialize: function (serialized) {
        if (!serialized) {
            return null;
        }
        return new EmberParseAdapter.GeoPoint(serialized.latitude, serialized.longitude);
    },

    serialize: function (deserialized) {
        if (!deserialized) {
            return null;
        }
        return {
            __type: 'GeoPoint',
            latitude: deserialized.get('latitude'),
            longitude: deserialized.get('longitude')
        };
    }

});

/*
 * The file transform handles Parse's custom data format. For
 * example a Parse file might come back from the REST API
 * looking like this:
 *
 * "registeredAt": {
 *   "__type": "File",
 *   "name": "foo.jpg",
 *   "url": "http://some.s3.url.com/foo.jpg"
 * }
 *
 * This helper deserializes that structure into a special
 * EmberParseAdapter.File object. This object should not be
 * changed, instead set a new file object to the property.
 *
 * this.store.find('model').then(function(model){
 *   model.get('someFile'); // -> File object
 *   model.get('someFile.url'); // -> someFile URL
 *
 *   var file = new EmberParseAdapter.File('foo.jpg', url);
 *   model.set('someFile', file);
 * });
 *
 * When saving a record, the EmberParseAdapter.File object
 * is likewise serialized into the Parse REST API format.
 *
 * @class EmberParseAdapter.Transforms.File
 */
EmberParseAdapter.Transforms.File = DS.Transform.extend({

    deserialize: function (serialized) {
        if (!serialized) {
            return null;
        }
        return new EmberParseAdapter.File(serialized.name, serialized.url);
    },

    serialize: function (deserialized) {
        if (!deserialized) {
            return null;
        }
        return {
            __type: 'File',
            name: deserialized.get('name'),
            url: deserialized.get('url')
        };
    }

});

/*
 * The date transform handles Parse's custom data format. For
 * example a Parse date might come back from the REST API
 * looking like this:
 *
 * "registeredAt": {
 *   "__type": "Date",
 *   "iso": "2014-06-05T12:43:50.716Z"
 * }
 *
 * This helper deserializes that structure into a normal
 * JavaScript date object. In also performs the inverse:
 * converting a date object back into Parse's custom format.
 *
 * @class EmberParseAdapter.Transforms.Date
 */
EmberParseAdapter.Transforms.Date = DS.Transform.extend({

    deserialize: function (serialized) {
        if (!serialized) {
            return null;
        }
        return new Date(serialized.iso);
    },

    serialize: function (deserialized) {
        if (!deserialized) {
            return null;
        }
        return {
            __type: 'Date',
            iso: deserialized.toISOString()
        };
    }

});

EmberParseAdapter.setupContainer = function (container) {
    container.register('adapter:-parse', EmberParseAdapter.Adapter);
    container.register('serializer:-parse', EmberParseAdapter.Serializer);
    container.register('model:parse-user', EmberParseAdapter.ParseUser);
    container.register('transform:parse-geo-point', EmberParseAdapter.Transforms.GeoPoint);
    container.register('transform:parse-file', EmberParseAdapter.Transforms.File);
    container.register('transform:parse-date', EmberParseAdapter.Transforms.Date);
};

export default EmberParseAdapter;
