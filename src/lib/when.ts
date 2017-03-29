import { Observable } from 'rxjs/Observable';
import { Subscription } from 'rxjs/Subscription';

import { ArrayObserver, splice } from 'observe-js';
import { ChangeNotification, Model, TypedChangeNotification } from './model';
import * as isFunction from 'lodash.isfunction';
import * as isObject from 'lodash.isobject';
import * as isEqual from 'lodash.isequal';

import * as LRU from 'lru-cache';
import { Updatable } from './updatable';

const proxyCache = LRU(64);

import './standard-operators';

const identifier = /^[$A-Z_][0-9A-Z_$]*$/i;

export function whenPropertyInternal(target: any, valueOnly: boolean, ...propsAndSelector: Array<string|Function|string[]>): Observable<any> {
  if (propsAndSelector.length < 1) {
    throw new Error('Must specify at least one property!');
  }

  if (propsAndSelector.length === 1) {
    let ret = observableForPropertyChain(target, propsAndSelector[0] as string);
    return valueOnly ? ret.map(x => x.value) : ret;
  }

  let [selector] = propsAndSelector.splice(-1, 1);
  if (!(selector instanceof Function)) {
    throw new Error('In multi-item properties, the last function must be a selector');
  }

  let propsOnly = propsAndSelector as Array<string|string[]>;
  let propWatchers = propsOnly.map((p) =>
    valueOnly ?
      observableForPropertyChain(target, p).map(x => x.value) :
      observableForPropertyChain(target, p));

  return Observable.combineLatest(...propWatchers, selector).distinctUntilChanged((x, y) => isEqual(x, y));
}

export type ArrayChange<T> = { value: T[], splices: splice[] };
export function whenArray<TSource, TProp>(
    target: TSource,
    prop: (t: TSource) => TProp[]): Observable<ArrayChange<TProp>> {
  return when(target, prop).switchMap(x => observeArray(x).startWith({ value: x ? Array.from(x) : x, splices: []}));
}

export function observeArray<T>(arr: T[]): Observable<ArrayChange<T>> {
  if (!arr || !Array.isArray(arr)) return Observable.empty();

  return Observable.create((subj) => {
    let ao: ArrayObserver;

    try {
      ao = new ArrayObserver(arr);
      ao.open((s) => {
        subj.next({value: Array.from(arr), splices: s});
      });
    } catch (e) {
      subj.error(e);
    }

    return new Subscription(() => ao.close());
  });
}

export function observableForPropertyChain(target: any, chain: (Array<string> | string | Function), before = false): Observable<ChangeNotification> {
  let props: Array<string>;

  if (Array.isArray(chain)) {
    props = chain;
  } else if (isFunction(chain)) {
    props = functionToPropertyChain(chain as Function);
  } else {
    props = (chain as string).split('.');

    if (props.find((x) => x.match(identifier) === null)) {
      throw new Error("property name must be of the form 'foo.bar.baz'");
    }
  }

  let firstProp = props[0];
  let start = notificationForProperty(target, firstProp, before);

  if (isObject(target) && firstProp in target) {
    let val = target[firstProp];

    if (isObject(val) && (val instanceof Updatable)) {
      val = val.value;
    }

    start = start.startWith({ sender: target, property: firstProp, value: val });
  }

  if (props.length === 1) {
    return start.distinctUntilChanged((x, y) => isEqual(x.value, y.value));
  }

  return start    // target.foo
    .map((x) => {
      return observableForPropertyChain(x.value, props.slice(1), before)
        .map((y) => {
          // This is for target.foo.bar.baz, its sender will be
          // target.foo, and its property will be bar.baz
          return { sender: target, property: `${firstProp}.${y.property}`, value: y.value };
        });
    })
    .switch()
    .distinctUntilChanged((x, y) => isEqual(x.value, y.value));
}

export function notificationForProperty(target: any, prop: string, before = false): Observable<ChangeNotification> {
  if (!(target instanceof Model)) {
    return Observable.never();
  }

  if (!(prop in target)) {
    return Observable.never();
  }

  if (target[prop] instanceof Updatable) {
    return (before ? target.changing : target.changed)
      .startWith({sender: target, property: prop, value: target[prop]})
      .filter(({property}) => prop === property)
      .switchMap(cn => {
        let obs: Observable<any> = cn.value;
        return obs.skip(1)
          .map((value) => ({ sender: cn.sender, property: cn.property, value }));
      });
  }

  return (before ? target.changing : target.changed)
    .filter(({property}) => prop === property);
}

// tslint:disable-next-line:no-empty
const EMPTY_FN = () => {};
export class SelfDescribingProxyHandler {
  constructor(public name: string) {}

  get(_target: any, name: string) {
    return SelfDescribingProxyHandler.create(`${this.name}.${name}`);
  }

  apply() {
    return this.name;
  }

  static create(name = '') {
    let ret = proxyCache.get(name);
    if (ret) return ret;

    ret = new Proxy(EMPTY_FN, new SelfDescribingProxyHandler(name));
    proxyCache.set(name, ret);
    return ret;
  }
}

export function functionToPropertyChain(chain: Function): Array<string> {
  let input = SelfDescribingProxyHandler.create();
  let result: Function = chain(input);

  let ret: string = result();
  return ret.substring(1).split('.');
}

const didntWork = { failed: true };
export function fetchValueForPropertyChain(target: any, chain: Array<string>): { result?: any, failed: boolean } {
  let current = target;
  if (current instanceof Updatable && chain[0] !== 'value') {
    try {
      current = current.value;
    } catch (_e) {
      return didntWork;
    }
  }

  for (let i = 0; i < chain.length; i++) {
    try {
      current = current[chain[i]];
    } catch (_e) {
      return didntWork;
    }

    if (current === undefined) return didntWork;

    // NB: Current is a non-object; if we're at the end of the chain, we
    // should return it, if we're not, we're in an error state and should
    // bail
    if (!isObject(current))  {
      return (i === chain.length - 1) ? { result: current, failed: false} : didntWork;
    }

    if (current instanceof Updatable && chain[i + 1] !== 'value') {
      try {
        current = current.value;
      } catch (_e) {
        return didntWork;
      }
    }
  }

  return { result: current, failed: false };
}

export function getValue<T, TRet>(target: T, accessor: ((x: T) => TRet)): { result?: TRet, failed: boolean } {
  const propChain = functionToPropertyChain(accessor);
  return fetchValueForPropertyChain(target, propChain);
}

const defaultResultPredicate = (v: any) => Array.isArray(v) ? !!v.length : !!v;
export function getResultAfterChange<T extends Model, TProp>(
  target: T,
  selector: (value: T) => TProp,
  predicate: (value: TProp, index: number) => boolean = defaultResultPredicate,
  numberOfChanges: number = 1)
: Promise<TProp> {
  return whenPropertyInternal(target, true, selector)
    .filter(predicate)
    .take(numberOfChanges)
    .toPromise();
}

/*
 * Extremely boring and ugly type descriptions ahead
 */

export type PropSelector<TIn, TOut> = (t: TIn) => TOut;

export function when<TSource, TRet>(
    target: TSource,
    prop: PropSelector<TSource, TRet>): Observable<TRet>;

export function when<TSource, TProp1, TProp2, TRet>(
    target: TSource,
    prop1: PropSelector<TSource, TProp1>,
    prop2: PropSelector<TSource, TProp2>,
    sel: ((p1: TProp1, p2: TProp2) => TRet)):
  Observable<TRet>;

export function when<TSource, TProp1, TProp2, TProp3, TRet>(
    target: TSource,
    prop1: PropSelector<TSource, TProp1>,
    prop2: PropSelector<TSource, TProp2>,
    prop3: PropSelector<TSource, TProp3>,
    sel: ((p1: TProp1, p2: TProp2, p3: TProp3) => TRet)):
  Observable<TRet>;

export function when<TSource, TProp1, TProp2, TProp3, TProp4, TRet>(
    target: TSource,
    prop1: PropSelector<TSource, TProp1>,
    prop2: PropSelector<TSource, TProp2>,
    prop3: PropSelector<TSource, TProp3>,
    prop4: PropSelector<TSource, TProp4>,
    sel: ((p1: TProp1, p2: TProp2, p3: TProp3, p4: TProp4) => TRet)):
  Observable<TRet>;

export function when<TSource, TRet>(
    target: TSource,
    prop: string): Observable<TRet>;

export function when<TSource, TProp1, TProp2, TRet>(
    target: TSource,
    prop1: string,
    prop2: string,
    sel: ((p1: TProp1, p2: TProp2) => TRet)):
  Observable<TRet>;

export function when(target: any, ...propsAndSelector: Array<string|Function|string[]>): Observable<any> {
  return whenPropertyInternal(target, true, ...propsAndSelector);
}

export function whenProperty<TSource, TRet>(
    target: TSource,
    prop: PropSelector<TSource, TRet>):
  Observable<TypedChangeNotification<TSource, TRet>>;

export function whenProperty<TSource, TProp1, TProp2, TRet>(
    target: TSource,
    prop1: PropSelector<TSource, TProp1>,
    prop2: PropSelector<TSource, TProp2>,
    sel: ((p1: TypedChangeNotification<TSource, TProp1>, p2: TypedChangeNotification<TSource, TProp2>) => TRet)):
  Observable<TypedChangeNotification<TSource, TRet>>;

export function whenProperty<TSource, TProp1, TProp2, TProp3, TRet>(
    target: TSource,
    prop1: PropSelector<TSource, TProp1>,
    prop2: PropSelector<TSource, TProp2>,
    prop3: PropSelector<TSource, TProp3>,
    sel: ((
      p1: TypedChangeNotification<TSource, TProp1>,
      p2: TypedChangeNotification<TSource, TProp2>,
      p3: TypedChangeNotification<TSource, TProp3>) => TRet)):
  Observable<TypedChangeNotification<TSource, TRet>>;

export function whenProperty<TSource, TProp1, TProp2, TProp3, TProp4, TRet>(
    target: TSource,
    prop1: PropSelector<TSource, TProp1>,
    prop2: PropSelector<TSource, TProp2>,
    prop3: PropSelector<TSource, TProp3>,
    prop4: PropSelector<TSource, TProp4>,
    sel: ((
      p1: TypedChangeNotification<TSource, TProp1>,
      p2: TypedChangeNotification<TSource, TProp2>,
      p3: TypedChangeNotification<TSource, TProp3>,
      p4: TypedChangeNotification<TSource, TProp4>) => TRet)):
  Observable<TypedChangeNotification<TSource, TRet>>;

export function whenProperty(target: any, ...propsAndSelector: Array<string|Function|string[]>): Observable<any> {
  return whenPropertyInternal(target, false, ...propsAndSelector);
}