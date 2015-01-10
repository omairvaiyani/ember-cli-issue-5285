export default {
    /**
     * Unique Suggestions
     * Send the suggestions received from Swiftype,
     * match against whatever records are already held,
     * and return only unique suggestions.
     *
     * Example case:
     * Adding tests to groups. No need to suggest
     * tests already added to group and no need to
     * suggest tests already selected from previous
     * suggestions received from swiftype.
     *
     * @param {Array} suggestions (provided by Swiftype)
     * @param {Ember.A} previousRecorsd (mixture of Ember Array and Swiftype array)
     * @param {Integer} limit defaultValue = 5
     */
    uniqueSuggestions: function (suggestions, previousRecords, limit) {
        if(!limit)
            limit = 5;
        var uniqueSuggestions = new Ember.A();
        for (var i = 0; i < suggestions.length; i++) {
            var suggestion = suggestions[i],
                isUnique = true;
            previousRecords.forEach(function (record) {
                var recordId = record.external_id ? record.external_id : record.get('id');
                if(recordId === suggestion.external_id)
                    return isUnique = false;
            });
            if(isUnique)
                uniqueSuggestions.pushObject(suggestion);
            if(uniqueSuggestions.length === limit)
                break;
        }
        return uniqueSuggestions;
    }
}
