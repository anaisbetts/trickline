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

function determineDependentUrls(targetFile, urlRoot, rootDir, fileInfo={}) {
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
    hrefs.push(href);
  });
  
  $('script').map((i, el) => {
    let href = $(el).attr('src');
    if (!href || href.length < 3) return;
    hrefs.push(href);
  });
    
  for (let href of hrefs) {
    ret.push(href);
    
    let realFile = urlToFilePath(urlRoot, rootDir, targetFile, href);
    if (!realFile) return;
    
    let suburls = determineDependentUrls(realFile, urlRoot, rootDir, fileInfo) || [];
    for (let suburl of suburls) { ret.push(suburl); }
  }
}

export default function autoPush(fileRoot, urlRoot='') {
  const cache = {};
  const realRoot = path.resolve(fileRoot);
  
  return (res, filePath) => {
    if (!cache[path]) {
      cache[path] = determineDependentUrls(urlRoot, realRoot, filePath);
    }
    
    for (let item of cache[path]) {
      res.append('Link', `<${item}>; rel=preload`);
    }
    
    res.append(
      'X-Associated-Content', 
      _.map(cache[path], (x) => `"${x}"`).join(","));
  };
}
