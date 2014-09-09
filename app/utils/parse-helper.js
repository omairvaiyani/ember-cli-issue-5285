import
StringHelper
from
'../utils/string-helper';

export default {
    generatePointer: function(object) {
        var className = object.constructor.typeKey;
        if(className === "parseUser")
            className = "_User";
        return {
            "__type": "Pointer",
            "className": StringHelper.upperCaseFirst(className),
            "objectId": object.get('id')
        }
    },
    generatePointers: function(array) {
        var pointers = [];
        array.forEach(function(object) {
            pointers.push(this.generatePointer(object));
        }.bind(this));
        return pointers;
    },

    generateSearchTags: function (searchTerm) {
        return _.filter(searchTerm.toLowerCase().split(' '), function (w) {
            return w.match(/^\w+$/) && !_.contains(this.stopWords, w);
        }.bind(this));
    },

    stopWords: ["the", "in", "and", "test", "mcqs", "of", "a", "an"]

}
