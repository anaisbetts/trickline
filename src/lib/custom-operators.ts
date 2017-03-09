import { Observable } from 'rxjs/Observable';
import { Scheduler } from 'rxjs/Scheduler';

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

export function guaranteedThrottle<T>(this: Observable<T>, time: number, scheduler?: Scheduler) {
    return this
      .map((x: any) => Observable.timer(time, scheduler).map(() => x))
      .switch();
}

Observable.prototype['breakOn'] = breakOn;
Observable.prototype['createCollection'] = createCollection;
Observable.prototype['guaranteedThrottle'] = guaranteedThrottle;

declare module 'rxjs/Observable' {
  interface Observable<T> {
    breakOn: typeof breakOn;
    createCollection: typeof createCollection;
    guaranteedThrottle: typeof guaranteedThrottle;
  }
}