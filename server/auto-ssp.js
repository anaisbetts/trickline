import fs from 'fs';
import path from 'path';
import cheerio from 'cheerio';
import _ from 'lodash';
import url from 'url';

function urlToFilePath(urlRoot, fileRoot, currentFile, urlStr) {
  // Protocol-relative URL?
  if (urlStr.match(/^\/\//)) return null;
  
  // Full URL? 
  if (urlStr.match(/^https?/i)) return null;
  
  let pathname = null;
  try {
    pathname = url.parse(urlStr).pathname.replace(urlRoot, '');
  } catch (e) {
    return null;
  }
  
  let finalPath = null;
  
  // Rooted path?
  if (pathname.match(/^\//)) {
    finalPath = path.resolve(fileRoot, pathname);
  } else {
    finalPath = path.resolve(path.dirname(currentFile), pathname);
  }
  
  if (!finalPath.startsWith(fileRoot)) {
    return null;
  }
  
  return finalPath;
}

function dedupeButMaintainOrdering(array) {
  let lookup = {};
  
  return _.filter(array, (x) => {
    if (x in lookup) return false;
    
    lookup[x] = true;
    return true;
  });
}

function determineDependentUrls(targetFile, urlRoot, rootDir, fileInfo={}) {
  console.log(`Scanning file: ${targetFile}`);
  if (!fs.existsSync(targetFile)) { 
    return null;
  }
  
  let suffix = path.resolve(targetFile).replace(rootDir, '');
  
  if (fileInfo[suffix]) return fileInfo[suffix];
  
  // NB: We create a entry early before we recurse, in order to 
  let ret = [];
  fileInfo[suffix] = ret;
  
  let $ = null;
  try {
    $ = cheerio.load(fs.readFileSync(targetFile, 'utf8'));
  } catch (e) {
    // NB: This sucks, but if we actually can't read the file we're going
    // to report it properly later anyways
    return null;
  }
  
  let hrefs = [];
  $('link').map((i, el) => {
    let href = $(el).attr('href');
    if (!href || href.length < 3) return;
    
    console.log(`Found href!: ${href}`);
    hrefs.push(href);
  });
  
  $('script').map((i, el) => {
    let href = $(el).attr('src');
    if (!href || href.length < 3) return;
    
    console.log(`Found href!: ${href}`);
    hrefs.push(href);
  });
    
  _.each(hrefs, (href) => {
    ret.push(href);
    
    let realFile = urlToFilePath(urlRoot, rootDir, targetFile, href);
    if (!realFile) return;
    
    if (!href.match(/.html/i)) return;
    
    let suburls = determineDependentUrls(realFile, urlRoot, rootDir, fileInfo) || [];
    _.each(suburls, (x) => ret.push(x));
  });
  
  return dedupeButMaintainOrdering(ret);
}

export default function autoPush(fileRoot, urlRoot='') {
  const cache = {};
  const realRoot = path.resolve(fileRoot);
  
  return (res, filePath) => {
    if (filePath.match(/bower_components/)) return;
    
    if (!cache[path]) {
      cache[path] = determineDependentUrls(filePath, urlRoot, realRoot);
    }
    
    _.each(cache[path], (item) => res.append('Link', `<${item}>; rel=preload`));
    
    res.set(
      'X-Associated-Content', 
      _.map(cache[path], (x) => `"${x}"`).join(","));
  };
}
