import fs from 'fs';
import path from 'path';
import cheerio from 'cheerio';
import _ from 'lodash';
import url from 'url';
import forAllFiles from './for-all-files';

/**
 * Map of file extension to request type.
 * See https://fetch.spec.whatwg.org/#concept-request-type
 */
const EXTENSION_TO_TYPE = {
  '.css': 'style',
  '.gif': 'image',
  '.html': 'document',
  '.png': 'image',
  '.jpg': 'image',
  '.js': 'script',
  '.json': 'script',
  '.svg': 'image',
  '.webp': 'style',
  '.woff': 'font',
  '.woff2': 'font'
};

function urlToFilePath(fileRoot, currentFile, urlStr) {
  // Protocol-relative URL?
  if (urlStr.match(/^\/\//)) return null;
  
  // Full URL? 
  if (urlStr.match(/^https?/i)) return null;
  
  let pathname = null;
  try {
    pathname = url.parse(urlStr).pathname;
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

function linksFromFile(targetFile) {
  //console.log(`Scanning file: ${targetFile}`);
  if (!fs.existsSync(targetFile)) { 
    return null;
  }

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
    
    //console.log(`Found href!: ${href}`);
    hrefs.push(href);
  });
  
  $('script').map((i, el) => {
    let href = $(el).attr('src');
    if (!href || href.length < 3) return;
    
    //console.log(`Found href!: ${href}`);
    hrefs.push(href);
  });
  
  return hrefs;
}

function determineDependentFiles(targetFile, rootDir) {
  let hrefs = linksFromFile(targetFile);
  
  return dedupeButMaintainOrdering(
    _.map(hrefs, (x) => urlToFilePath(rootDir, targetFile, x)));
}

function determineDependentUrls(targetFile, urlRoot, rootDir, fileInfo = {}) {
  if (fileInfo[targetFile]) return fileInfo;
  
  let ret = [];
  fileInfo[targetFile] = ret;
  
  let hrefs = linksFromFile(targetFile);
  
  _.each(hrefs, (href) => {
    let realFile = urlToFilePath(rootDir, targetFile, href);
    if (!realFile) return;
    
    ret.push(realFile.replace(rootDir, ''));
    
    if (fileInfo[realFile]) return;
    
    if (!href.match(/.html/i)) return;
    
    console.log(`Recursing into ${realFile}`);
    let suburls = determineDependentUrls(realFile, urlRoot, rootDir, fileInfo) || [];
    _.each(suburls, (x) => ret.push(x));
  });
  
  return dedupeButMaintainOrdering(ret);
}

export default function generatePushManifest(rootDir) {
  let fileCount = {};
  
  forAllFiles(rootDir, (file) => {
    if (file in fileCount) {
      fileCount[file]++;
    } else {
      fileCount[file] = 1;
    }
    
    let deps = determineDependentFiles(file, rootDir);
    _.each(deps, (f) => {
      if (f in fileCount) {
        fileCount[f]++;
      } else {
        fileCount[f] = 1;
      }
    });
  });
  
  // Files whose refcount are 1 means that no other file references them - 
  // that means they're a root file and we should generate a push manifest 
  // for them
  let filesToGenerate = _.reduce(Object.keys(fileCount), (acc, f) => {
    if (fileCount[f] > 1) return acc;
    if (f.match(/bower_components/)) return acc;
    if (!f.match(/.html$/i)) return acc;
    
    acc.push(f);
    return acc;
  }, []);
  
  console.log(`Root files! ${JSON.stringify(filesToGenerate)}`);
  let ret = _.reduce(filesToGenerate, (acc, x) => {
    acc[x] = {};
    
    console.log(`Looking at file: ${x}`);
    let subUrls = determineDependentUrls(x, '', rootDir);
    
    _.each(subUrls, (dep) => {
      let type = EXTENSION_TO_TYPE[path.extname(dep)];
      if (!type) return;
      
      acc[x][dep] = { weight: 10, type: type };
    });
    return acc;
  }, {});
  
  console.log(`Manifest! ${JSON.stringify(ret)}`);
  return ret;
}
