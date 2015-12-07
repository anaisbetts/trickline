var express = require('express');
var proxy = require('express-http-proxy');
var path = require('path');

var app = express();

app.use('/bower_components', express.static(path.join(__dirname, 'bower_components')));
app.use('/api', proxy('https://slack.com', {
  forwardPath: function(req, res) {
    console.log(req.url);
    return '/api' + require('url').parse(req.url).path;
  }
}));

app.use(express.static(path.join(__dirname, 'dist')));

var server = app.listen(process.env.PORT || 8080, function() {
  var host = server.address().address;
  var port = server.address().port;
  
  console.log('App listening at http://%s:%s', host, port);
});
