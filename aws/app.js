require('newrelic');
var express = require('express'),
    app = express(),
    port = process.env.PORT || 3000,
    redis = require("redis").createClient('9959', 'jack.redistogo.com'),
    schedule = require('node-schedule'),
    rule = new schedule.RecurrenceRule(),
    logentries = require('node-logentries'),
    log = logentries.logger({
        token: 'bd764afe-c1f7-4869-a762-b19a626a7f16'
    }),
    currentDeploy,
    indexFile;
app.enable('trust proxy'); // Needed to verify request protocols for SSL
app.use(require('prerender-node').set('prerenderToken', 'BToHzVZjPpLEjKzghygK'));
log.info("Server fired up.");

redis.auth('9133e11ec07b2885c35237ab4aa85ecf', function (response) {
    log.info("Redis authenticated successfully");
});

var checkForAppUpdate = function () {
    redis.get('currentDeploy', function (err, value) {
        if (err)
            log.info("Redis.checkForAppUpdate error: " + err);
        else if (value) {
            if (currentDeploy !== value) {
                log.info("New index file detected! Key: " + value);
                currentDeploy = value;
                updateIndexFile();
            } else {

            }
        } else {
            log.log("Redis.checkForAppUpdate", {"error": err});
        }
    });
}
/*
 * Runs straight away on deploy:
 * Then, every 60 seconds.
 */
checkForAppUpdate();
setInterval(checkForAppUpdate, 60000);

var updateIndexFile = function () {
    log.info("Updating index file to key: " + currentDeploy);
    redis.get(currentDeploy, function (err, data) {
        if (err)
            log.info("Redis.updateIndexFile error: " + err);
        else if (data) {
            log.info("Index file updated on " + new Date());
            indexFile = data;
        } else {
            log.info("Index file with set currentDeploy key not found on " + new Date());
        }
    });
}

app.all('/sitemap.xml', function (req, res) {
    res.writeHead(301,
        {Location: 'https://d3uzzgmigql815.cloudfront.net/sitemap.xml'}
    );
    res.end();
});

app.all('/robots.txt', function (req, res) {
    res.sendFile(__dirname + '/robots.txt');
});

app.all('/crossdomain.xml', function (req, res) {
    res.sendFile(__dirname + '/crossdomain.xml');
});

app.all('/scripts/*', function (req, res) {
    res.writeHead(307,
        {Location: 'http://69.195.73.81' + req.url}
    );
    res.end();
});


app.all('/blog*', function (req, res) {
    res.sendFile(__dirname + "/blog.html");
});


app.get("*", function (req, res) {
    if (req.headers.host.match(/^www/) !== null || !req.secure) {
        res.redirect(301, 'https://' + req.headers.host.replace(/^www\./, '') + req.url);
    }
    if (!indexFile) {
        res.sendFile(__dirname + '/index.html');
    }
    else {
        res.send(indexFile);
    }
});

app.use(express.static(__dirname + '/'));

app.listen(port, function () {
    log.info("Listening on port: " + port);
});

