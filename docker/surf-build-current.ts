import * as path from 'path';
import * as os from 'os';
import 'rxjs';

import { spawn, spawnPromise } from 'spawn-rx';
import { config } from 'dotenv';

config();

const rootDir = path.dirname(require.resolve('../package.json'));

export async function spawnNoisyPromise(cmd, args, opts) {
  const ret = spawn(cmd, args, opts);

  return ret
    .do(x => console.log(x))
    .reduce((acc, x) => true)
    .toPromise();
}

export async function main() {
  const ourSha = await spawnPromise('git', ['rev-parse', 'HEAD']);

  console.log("Building Docker Image...");
  await spawnNoisyPromise('docker', ['build', '-t', 'surf-trickline', '.'], {cwd: path.join(rootDir, 'docker')});

  console.log("Running build...");
  await spawnNoisyPromise('docker', [
    'run',
    '-e', `GITHUB_TOKEN=${process.env.GITHUB_TOKEN}`,
    '-e', `SLACK_API_TOKEN=${process.env.SLACK_API_TOKEN}`,
    'surf-trickline',
    'surf-build',
    '-s', ourSha,
    '-n', `surf-docker-${os.hostname()}`]);
}

if (process.mainModule === module) {
    main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e.message);
      console.error(e.stack);
      process.exit(-1);
    });
}
