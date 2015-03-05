var parseAppId = "DjQgBjzLml5feb1a34s25g7op7Zqgwqk8eWbOotT",
    restApiId = "xN4I6AYSdW2P8iufiEOEP1EcbiZtdqyjyFBsfOrh",
    parseJSId = "3gLHMYHWB2QFrv4MOSgi4xA6MnAowdMw9UMw3NJM";

import EmberParseAdapter from '../adapters/parse';

/*
 * Parse Initialzed in app.js
 */
export default EmberParseAdapter.Adapter.extend({
    applicationId: parseAppId,
    restApiId: restApiId,
    javascriptId: parseJSId
});
