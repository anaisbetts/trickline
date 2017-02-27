import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

let v8profiler: any = null;

export function takeHeapSnapshot() {
  v8profiler = v8profiler || require('@paulcbetts/v8-profiler');

  const snapshot = v8profiler.takeSnapshot();
  const target = path.join(os.tmpdir(), `trickline-Heapshot-${(new Date()).toISOString()}.json`);

  let ret = new Promise((res,rej) => {
    snapshot.export()
      .pipe(fs.createWriteStream(target))
      .on('finish', res(target))
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