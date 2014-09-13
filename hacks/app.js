var express = require('express'),
    fs = require('fs'),
    app = express(),
    distPath = __dirname + '/mycqs-web/dist';
app.use(express.static(distPath));

app.get('*', function (req, res) {
    if (fs.existsSync(distPath + req.url)) {
        res.sendFile(distPath + req.url);
    } else
        res.sendFile(distPath + '/index.html');
});

app.listen(80, function () {
    console.log('Listening on port 80');
});