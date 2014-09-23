require('newrelic');

var port = process.env.PORT || 3000,
    http = require("http");


var static = require('node-static');

//
// Create a node-static server instance to serve the './public' folder
//
var file = new static.Server();

var server = http.createServer(function (request, response) {
    request.addListener('end', function () {
        file.serveFile('index.html', 200, {}, request, response);
    }).resume();
}).listen(port);