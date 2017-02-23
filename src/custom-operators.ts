import {Observable} from 'rxjs/Observable';
import {Model} from './model';

export function createCollection<T>(this: Observable<T>): Array<T> {
  let ret: Array<T> = [];
  this.subscribe((x) => ret.push(x));

  return ret;
}

Observable.prototype['createCollection'] = createCollection;

declare module 'rxjs/Observable' {
  interface Observable<T> {
    createCollection: typeof createCollection;
  }
}