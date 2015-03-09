import
StringHelper
from
'../utils/string-helper';

export default {
    generatePointer: function(object, className) {
        if(!className)
            className = object.constructor.typeKey;
        if(className === "parseUser")
            className = "_User";
        return {
            "__type": "Pointer",
            "className": StringHelper.upperCaseFirst(className),
            "objectId": object.get('id')
        }
    },
    generatePointerFromIdAndClass: function(objectId, className) {
        if(!objectId || !className)
            return;
        if(className === "parseUser")
            className = "_User";
        return {
            "__type": "Pointer",
            "className": StringHelper.upperCaseFirst(className),
            "objectId": objectId
        }
    },
    generatePointers: function(array) {
        var pointers = [];
        array.forEach(function(object) {
            pointers.push(this.generatePointer(object));
        }.bind(this));
        return pointers;
    },

    generatePointerFromNativeParse: function(object) {
        var className = object.className,
            id = object.id;

        if(!id)
            id = object.get('id');
        if(!id)
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
        if(!user)
            return "https://d3uzzgmigql815.cloudfront.net/img/silhouette.png";

        if (user.get('profilePicture')) {
            return this.getSecureParseUrl(user.get('profilePicture').get('url'));
        } else if (user.get('fbid')) {
            return "https://graph.facebook.com/"+user.get('fbid')+"/picture?height=250&type=square";
        } else {
            return "https://d3uzzgmigql815.cloudfront.net/img/silhouette.png";
        }
    },

    getSecureParseUrl: function (url) {
        if(url)
            return url._url.replace("http://", "https://s3.amazonaws.com/");
        else
            return "";
    },

    extractRawPayload: function (store, type, rawPayload, key) {
        var serializer = store.serializerFor(type),
            payload = rawPayload.result[key];
        _.each(payload, function (object) {
            object["id"] = object.objectId;
        });
        var serializedObjects = serializer.extractArray(store,
            store.modelFor(type), {results: payload});
        return store.pushMany(store.modelFor(type), serializedObjects);
    }

}
