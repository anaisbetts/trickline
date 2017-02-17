import {Observable} from 'rxjs/Observable';

function createCollection<T>(this: Observable<T>): Array<T> {
  let ret: Array<T> = [];
  this.subscribe((x) => ret.push(x));

  return ret;
}

Observable.prototype['createCollection'] = createCollection;
