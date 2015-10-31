import express from 'express';
import compression from 'compression';
import path from 'path';

const app = express();

app.use(compression());

let thePath = path.resolve(__dirname, '..', 'dist');
console.log(`Serving up ${thePath}`);
app.use(express.static(thePath));

let server = app.listen(process.env.PORT || 8080, () => {
  var host = server.address().address;
  var port = server.address().port;
  
  console.log('App listening at http://%s:%s', host, port);
});
