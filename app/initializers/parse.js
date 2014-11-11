import EmberParseAdapter from '../adapters/parse';

export default {
    after: "ember-data",
    name: "parse-adapter",

    initialize: function (container, application) {
        EmberParseAdapter.setupContainer(container);
    }
};
