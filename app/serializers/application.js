import serializer from 'ember-parse-adapter/serializers/application';

serializer.reopen({
    isNewSerializerAPI: false,

    /**
     * @Override Serialize Has Many
     *
     * Array pointers are better off
     * being handled without the
     * 'AddUnique'/'Remove' operations.
     * We seem to send the whole array
     * anyways when saving parent objects.
     * More importantly, objects were not
     * being removed from arrays because
     * the 'AddUnique' op was added
     * when it shouldn't be.
     *
     * @param snapshot
     * @param json
     * @param relationship
     */
    serializeHasMany: function (snapshot, json, relationship) {
        var key = relationship.key,
            hasMany = snapshot.hasMany(key),
            options = relationship.options,
            _this = this;

        if (hasMany && hasMany.get('length') > 0) {
            json[key] = [];

            if (options.relation) {
                json[key].__op = 'AddRelation';
            }

            hasMany.forEach(function (child) {
                json[key].push({
                    '__type': 'Pointer',
                    'className': _this.parseClassName(child.type.typeKey),
                    'objectId': child.id
                });
            });

        } else {
            json[key] = [];
        }
    }
});

/** @module serializers/application */
export default serializer;