///
/// A very simple Loggly client for Parse.com cloudcode.
/// Usage:
///     logger = require('cloud/libs/logger');
///		logger.setToken('your-loggly-token', 'appname'); // Appname is optional.
///
///     logger.log("A String to Log", {'key': 'Extra fields to add to loggly entry'});
///	           /// The logger will add a few fields replicating the iOS client fields to help filtering and setting up a grid view on Loggly.
///
///     logger.setConsoleLogging(false);		// Stop the logger exhoing to Parse's console.
/// 
///
/// Notes: The logger assumes that Parse.com honour Node's feature that imports are cached so calling import from one 
///        module returns the same module.exports as a previous call to that module.
///        if you start seeing 'not-set' in your URLs either you haven't ever called setToken or Parse are not honouring this promise and
///        you will need to call set token wheever you import logger.
///

//winston.add(winston.transports.Loggly, {
//    token: "4934f004-77dc-4d9a-9209-faa3e0d7054d",
//    subdomain: "trysynap",
//    tags: ["Winston-NodeJS"],
//    json:true
//});

var DEBUG = true;

var logger = (function () {
    var LOGGLY_PROTOCOL = 'http',
        LOGGLY_API_DOMAIN = 'logs-01.loggly.com',
        LOGGLY_URL_PREFIX = '/inputs/';

    // Rely on Parse.com using node module caching to not duplicate this stuff.
    var logglyToken = '4934f004-77dc-4d9a-9209-faa3e0d7054d';
    var urlSet = false;
    var logglyURL;
    var appName = "Synap";
    var alsoLogToConsole = true;


    function setupURL() {
        logglyURL = LOGGLY_PROTOCOL + '://' + LOGGLY_API_DOMAIN + LOGGLY_URL_PREFIX + logglyToken;
        urlSet = true;
    }

    // Return from the clouse executed as main entry point to this module.
    // effectively the 'public' methods for this 'singleton'
    return {
        setToken: function (token, newAppName) {
            logglyToken = token;
            appName = newAppName;
            urlSet = false;
        },

        setConsoleLogging: function (shouldLog) {
            alsoLogToConsole = shouldLog;
        },

        slugify: function (string) {
            if(!string)
                return "";
            return string.replace(/ /g, '-').replace(/[-]+/g, '-').replace(/[^\w-]+/g, '').toLowerCase();
        },

        /**
         * @Function Log
         * extraLogData is optional
         * @param {String} logTag
         * @param {String} logString
         * @param {Object} extraLogData
         */
        log: function (logTag, logString, extraLogData) {
            if (!urlSet)
                setupURL();

            var date = new Date(),
                tagUrl = "/tag/general/";
            if (logTag)
                tagUrl = "/tag/" + this.slugify(logTag) + "/";

            // Build the body to send to Loggly
            var body;
            if (typeof(logString) === 'string') {

                if (alsoLogToConsole)
                    console.log(logString);

                date = new Date();
                body = {
                    'message': logString,
                    'devicename': 'cloudcode',
                    'appname': appName,
                    'timestamp': date
                };
                if (typeof (extraLogData) !== 'undefined') {
                    body.params = extraLogData;
                }
            } else {
                // We have an object as our first paramater so simply send that
                // without any extra adornment

                if (alsoLogToConsole)
                    console.log(JSON.stringify(logString));
                body = logString;
            }

            if (DEBUG)
                console.log("logging " + JSON.stringify(body) + " to : " + logglyURL);

            Parse.Cloud.httpRequest({
                'method': 'POST',
                'url': logglyURL + tagUrl,
                'headers': {
                    'Content-Type': 'application/json'
                },
                'body': body,
                success: function (response) {
                    if (DEBUG)
                        console.log('successfully logged: ' + response.text)
                },
                error: function (httpResponse) {
                    if (DEBUG)
                        console.log('Loggly request failed with response code ' + httpResponse.status + ' url was ' + logglyURL + tagUrl)
                }
            });
        }
    }

})();	// Trailing () causes the closure to execute. We export the return object.

module.exports = logger;