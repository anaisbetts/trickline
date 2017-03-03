import { Observable } from 'rxjs/Observable';

export function createCollection<T>(this: Observable<T>): Array<T> {
  let ret: Array<T> = [];
  this.subscribe((x) => ret.push(x));

  return ret;
}

export function breakOn<T>(this: Observable<T>, selector: ((x: T) => boolean)): Observable<T> {
  return this.lift({
    call: (sub, src) => src.subscribe((x: T) => {
      if (selector(x)) debugger;
      sub.next(x);
    }, sub.error.bind(sub), sub.complete.bind(sub))
  });
}

Observable.prototype['createCollection'] = createCollection;
Observable.prototype['breakOn'] = breakOn;

declare module 'rxjs/Observable' {
  interface Observable<T> {
    createCollection: typeof createCollection;
    breakOn: typeof breakOn;
  }
}