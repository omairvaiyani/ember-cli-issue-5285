import serializer from 'ember-parse-adapter/serializers/application';

serializer.reopen({
    isNewSerializerAPI: false
});

/** @module serializers/application */
export default serializer;