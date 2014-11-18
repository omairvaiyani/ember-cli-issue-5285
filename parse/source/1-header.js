// Concat source to main.js with 'cat source/*.js > cloud/main.js'

var _ = require("underscore"),
    moment = require('cloud/moment-timezone-with-data.js'),
    mandrillKey = 'zAg8HDZtlJSoDu-ozHA3HQ',
    Mandrill = require('mandrill'),
    Stripe = require('stripe');

Mandrill.initialize(mandrillKey);

//Stripe.initialize('sk_test_AfBhaEg8Yojoc1hylUI0pdtc'); // testing key
 Stripe.initialize('sk_live_AbPy747DUMLo8qr53u5REcaX'); // live key

var MyCQs = {
    baseUrl: 'http://mycqs.com/'
};
var FB = {
    API: {
        url: 'https://graph.facebook.com/v2.1/me/'
    },
    GraphObject: {
        appId: "394753023893264",
        namespace: "mycqs_app",
        testUrl: MyCQs.baseUrl + "test/"
    }
};
var PromiseHelper = {
    ABORT_CHAIN: 100
};