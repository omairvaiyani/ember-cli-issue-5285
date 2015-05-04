import config from './../config/environment';
import EmberParseAdapter from '../adapters/parse';

/*
 * Parse Initialzed in app.js
 */
export default EmberParseAdapter.Adapter.extend({
    applicationId: config.parse.appId,
    restApiId: config.parse.restKey,
    javascriptId: config.parse.jsKey
});
