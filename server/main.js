import express from 'express';
import compression from 'compression';
import path from 'path';
import autoPush from './auto-ssp';

const app = express();

app.use(compression());

let thePath = path.resolve(__dirname, '..', 'dist');
console.log(`Serving up ${thePath}`);

app.use('/bower_components', express.static(path.join(thePath, '..', 'bower_components')));
app.use(express.static(thePath));

let server = app.listen(process.env.PORT || 8080, () => {
  var host = server.address().address;
  var port = server.address().port;
  
  console.log('App listening at http://%s:%s', host, port);
});
