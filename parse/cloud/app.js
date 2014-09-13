var express = require('express');

var app = express.createServer();

app.use(express.staticProvider(__dirname + '/app/dist'));
app.register('.html', require('jade'));

app.get('*', function(req, res) {
    res.render('index.html');
});

app.listen();
