// Concat source to main.js with 'cat source/*.js > cloud/main.js'

var _ = require("underscore"),
    moment = require('cloud/moment-timezone-with-data.js'),
    mandrillKey = 'zAg8HDZtlJSoDu-ozHA3HQ',
    Mandrill = require('mandrill'),
    Stripe = require('stripe'),
    algoliasearch = require('cloud/algoliasearch.parse.js'),
    algoliaClient = algoliasearch('ONGKY2T0Y8', 'b13daea376f182bdee7a089ade58b656');

// Algolia Indices
var testIndex = algoliaClient.initIndex('Test'),
    userIndex = algoliaClient.initIndex('User');

Mandrill.initialize(mandrillKey);

Stripe.initialize('sk_test_AfBhaEg8Yojoc1hylUI0pdtc'); // testing key
//Stripe.initialize('sk_live_AbPy747DUMLo8qr53u5REcaX'); // live key

var APP = {
    baseUrl: 'https://synap.mycqs.com/',
    baseCDN: 'https://d3uzzgmigql815.cloudfront.net/'
};
var FB = {
    API: {
        url: 'https://graph.facebook.com/v2.3/me/'
    },
    GraphObject: {
        appId: "394753023893264",
        namespace: "mycqs_app",
        testUrl: APP.baseUrl + "test/"
    }
};