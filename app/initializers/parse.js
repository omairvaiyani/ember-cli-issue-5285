import EmberParseAdapter from '../adapters/parse';

export default {
    after: "ember-data",
    name: "parse-adapter",

    /**
     * @Function Initialize
     *
     * Sets Ember-Parse-Adapter as default adapter.
     *
     * Fetches Parse.Config:
     * > Application Readiness deferred <
     *
     * @param container
     * @param application
     */
    initialize: function (container, application) {
        EmberParseAdapter.setupContainer(container);
        application.deferReadiness();
        var store = container.lookup('store:main'),
            adapter = store.adapterFor('application');
        adapter.ajax("https://api.parse.com/1/config", "GET", {}).then(
            function (response) {
                var parseConfig = response.params;
                container.register('config:parse', parseConfig, {instantiate: false, singleton: true});
                container.injection('controller:application', 'parseConfig', 'config:parse');
            },
            function (reason) {
                console.error(reason);
            }).then(function () {
                application.advanceReadiness();
            });
    }
};
