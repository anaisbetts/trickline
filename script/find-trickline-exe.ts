import * as fs from 'fs';
import * as path from 'path';

const rootDir = path.dirname(require.resolve('../package.json'));

if (!fs.existsSync(path.join(rootDir, 'out'))) {
  throw new Error('Package the app first!');
}

const dirName = fs.readdirSync(path.join(rootDir, 'out'))
  .find(x => !!x.match(/^.+-.+-.+$/));

if (!dirName) {
  throw new Error('Package the app first!');
}

const [packageId, platform] = dirName.split('-');
switch(platform) {
case 'win32':
  console.log(path.join(rootDir, 'out', dirName, `${packageId}.exe`));
  break;
case 'linux':
  console.log(path.join(rootDir, 'out', dirName, `${packageId}`));
  break;
case 'darwin':
  console.log(path.join(rootDir, 'out', dirName, `${packageId}.app`, 'Contents', 'MacOS', packageId));
  break;
}