import path from 'path';
import _ from 'lodash';
import generatePushManifest from './generate-push-manifest';

export default function autoPush(fileRoot, urlRoot='') {
  const realRoot = path.resolve(fileRoot);
  
  let pushManifest = generatePushManifest(realRoot);
  
  return (res, filePath) => {
    if (!pushManifest[filePath]) return;
  
    _.each(
      Object.keys(pushManifest[filePath]), 
      (item) => res.append('Link', `<${item}>; rel=preload, type=${pushManifest[filePath][item].type}`));
    
    res.set(
      'X-Associated-Content', 
      _.map(Object.keys(pushManifest[filePath]), (x) => `"${x}"`).join(","));
  };
}
