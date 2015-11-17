import path from 'path';
import _ from 'lodash';
import generatePushManifest from './generate-push-manifest';

export default function autoPush(fileRoot) {
  const realRoot = path.resolve(fileRoot);
  
  let pushManifest = generatePushManifest(realRoot);
  
  return (res, filePath) => {
    if (!pushManifest[filePath]) return;
  
    _.each(
      Object.keys(pushManifest[filePath]), 
      (item) => res.append('Link', `<${item}>; rel=preload, type=${pushManifest[filePath][item].type}`));
    
    let content = _.map(_.take(Object.keys(pushManifest[filePath]), 3), (x) => `"${x}"`).join(",");
    console.log(`Content! ${content}`);
    res.append('X-Associated-Content', content);
  };
}
