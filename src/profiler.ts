import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { contentTracing } from 'electron';

let v8profiler: any = null;

function getTargetFilename(type: string) {
  const targetDir = process.env['SURF_ARTIFACT_DIR'] || os.tmpdir();
  const file = `trickline-${type}-${(new Date()).toISOString()}.json`.replace(/:/g, '-');

  return path.join(targetDir, file);
}

export function takeHeapSnapshot() {
  v8profiler = v8profiler || require('@paulcbetts/v8-profiler');

  const snapshot = v8profiler.takeSnapshot();
  const target = getTargetFilename('heapshot');

  let ret = new Promise((res, rej) => {
    let writeStream;
    try {
      writeStream = fs.createWriteStream(target);
    } catch (e) {
      rej(e);
    }

    snapshot.export()
      .pipe(writeStream)
      .on('finish', () => res(target))
      .on('error', rej);
  });

  return ret.then((ret) => {
    snapshot.delete();
    return ret;
  }, (e) => {
    snapshot.delete();
    return Promise.reject(e);
  });
}

export function startTracing() {
  const categories = [
    'blink.console',
    'devtools.timeline',
    'toplevel',
    'disabled-by-default-devtools.timeline',
    'disabled-by-default-devtools.timeline.frame'
  ];

  const options = {
    categoryFilter: categories.join(','),
    //categoryFilter: '*',
    traceOptions: 'record-until-full,enable-sampling'
  };

  return new Promise((res) => {
    contentTracing.startRecording(options, () => res(true));
  });
}

export function stopTracing() {
  return new Promise((res) => {
    contentTracing.stopRecording('', (file) => {
      const target = getTargetFilename('timeline');

      fs.renameSync(file, target);
      res(target);
    });
  });
}