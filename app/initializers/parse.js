import EmberParseAdapter from '../adapters/parse';

export default {
    after: "ember-data",
    name: "parse-adapter",

    initialize: function (container, application) {
        /*
         * Parse keys also used in ApplicationAdapter
         */
        Parse.initialize("DjQgBjzLml5feb1a34s25g7op7Zqgwqk8eWbOotT", "3gLHMYHWB2QFrv4MOSgi4xA6MnAowdMw9UMw3NJM");

        EmberParseAdapter.setupContainer(container);
    }
};
