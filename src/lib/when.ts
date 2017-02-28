import { Observable } from 'rxjs/Observable';
import { ChangeNotification, Model } from './model';

import * as LRU from 'lru-cache';
import {Updatable} from './updatable';

const proxyCache = LRU(64);

import './standard-operators';

function isObject(o: any): Boolean {
  return o === Object(o);
}

export interface WhenSelector<TRet> { (...vals: Array<any>) : TRet; };

const identifier = /^[$A-Z_][0-9A-Z_$]*$/i;

export function when<TRet>(target: any, prop1: string): Observable<TRet>;
export function when<TRet>(target: any, prop1: string, prop2: string, sel: WhenSelector<TRet>): Observable<TRet>;
export function when<TRet>(target: any, prop1: string, prop2: string, prop3: string, sel: WhenSelector<TRet>): Observable<TRet>;
export function when<TRet>(target: any, prop1: string, prop2: string, prop3: string, prop4: string, sel: WhenSelector<TRet>): Observable<TRet>;
export function when(target: any, ...propsAndSelector: Array<string|Function>): Observable<any> {
  if (propsAndSelector.length < 1) {
    throw new Error('Must specify at least one property!');
  }

  if (propsAndSelector.length === 1) {
    return observableForPropertyChain(target, propsAndSelector[0] as string);
  }

  let [selector] = propsAndSelector.splice(-1, 1);
  if (!(selector instanceof Function)) {
    throw new Error('In multi-item properties, the last function must be a selector');
  }

  let propsOnly = propsAndSelector as Array<string>;
  let propWatchers = propsOnly.map((p) => observableForPropertyChain(target, p));
  return Observable.combineLatest(...propWatchers, selector).distinctUntilChanged();
}

export function observableForPropertyChain(target: any, chain: (Array<string> | string), before = false): Observable<ChangeNotification> {
  let props: Array<string>;

  if (Array.isArray(chain)) {
    props = chain;
  } else {
    props = chain.split('.');

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
    return start.distinctUntilChanged((x, y) => x.value === y.value);
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
    .distinctUntilChanged((x, y) => x.value === y.value);
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


const EMPTY_FN = () => {};
export class SelfDescribingProxyHandler {
  name: string;

  constructor(name: string) {
    this.name = name;
  }

  get(_target: any, name: string) {
    return SelfDescribingProxyHandler.create(`${this.name}.${name}`);
  }

  apply() {
    return this.name;
  }

  static create(name='') {
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

Model.prototype.when = function(...args) { return when(this, ...args); }