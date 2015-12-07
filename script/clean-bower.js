var fs = require('fs');
var path = require('path');
var rimraf = require('rimraf');

function cleanNonsenseInDirectory(rootDir) {
  var entries = fs.readdirSync(rootDir);
  
  for (var i=0; i < entries.length; i++) {
    var current = entries[i];
    var fullPath = path.resolve(rootDir, current);
    
    if (current.match(/^demos?$/)) {
      rimraf.sync(fullPath);
      continue;
    }

    if (current.match(/^tests?$/)) {
      rimraf.sync(fullPath);
      continue;
    }

    if (current.match(/^\#$/)) {
      rimraf.sync(fullPath);
      continue;
    }
    
    var stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      cleanNonsenseInDirectory(fullPath);
    }
  }
}

cleanNonsenseInDirectory(path.resolve(__dirname, '..', 'bower_components'));
cleanNonsenseInDirectory(path.resolve(__dirname, '..', 'node_modules'));
