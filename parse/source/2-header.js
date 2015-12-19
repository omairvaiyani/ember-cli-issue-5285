// Concat source to main.js with 'cat source/*.js > cloud/main.js'

var _ = require("underscore"),
    moment = require('cloud/moment-timezone-with-data.js'),
    mandrillKey = 'TUCRsbnixKXZRq2nas_e8g',
    Mandrill = require('mandrill'),
    Stripe = require('stripe'),
    algoliasearch = require('cloud/algoliasearch.parse.js'),
    algoliaClient = algoliasearch('ONGKY2T0Y8', 'b13daea376f182bdee7a089ade58b656'),
    CryptoJS = require('cloud/crypto.js'), // Needed for Intercom hashing
    intercomKey = "Xhl5IzCrI-026mCaD5gqXpoO2WURA416KtCRlWsJ",
    logger = require("cloud/logentries.js"),
    cheerio = require('cloud/cheerio.js');

// Algolia Search Master-Indices
var testIndex = algoliaClient.initIndex('Test'),
    userIndex = algoliaClient.initIndex('User');

Mandrill.initialize(mandrillKey);

Stripe.initialize('sk_test_AfBhaEg8Yojoc1hylUI0pdtc'); // testing key
//Stripe.initialize('sk_live_AbPy747DUMLo8qr53u5REcaX'); // live key

var APP = {
    baseUrl: 'https://synap.ac/',
    baseCDN: 'https://s3-eu-west-1.amazonaws.com/synap-dev-assets/'
};