import { Observable } from 'rxjs/Observable';
import { Updatable, MergeStrategy } from './updatable';
import * as LRU from 'lru-cache';

import './standard-operators';

export type Pair<K, V> = { Key: K, Value: V };

export interface SparseMap<K, V> {
  listen(key: K, hint?: any): Updatable<V>;
  listenAll(): Map<K, Updatable<V>>;

  setDirect(key: K, value: Updatable<V>): Promise<void>;
  setLazy(key: K, value: Observable<V>): Promise<void>;
  invalidate(key: K): Promise<void>;
};

export class SparseMapMixins {
  static listenMany<K, V>(this: SparseMap<K, V>, keys: Array<K>, hint?: any): Map<K, Updatable<V>> {
    return keys.reduce((acc, x) => {
      acc.set(x, this.listen(x, hint));
      return acc;
    }, new Map<K, Updatable<V>>());
  }

  static get<K, V>(this: SparseMap<K, V>, key: K): Promise<V> {
    return this.listen(key).take(1).toPromise();
  }

  static getMany<K, V>(this: SparseMap<K, V>, keys: Array<K>, hint?: any): Promise<Map<K, V>> {
    return Observable.of(...keys)
      .flatMap(k => this.listen(k, hint).take(1).map(v => ({Key: k, Value: v})))
      .reduce((acc, x) => {
        acc.set(x.Key, x.Value);
        return acc;
      }, new Map<K, V>())
      .toPromise();
  }

  static setValue<K, V>(this: SparseMap<K, V>, key: K, value: V): Promise<void> {
    return this.setLazy(key, Observable.of(value));
  }

  static setPromise<K, V>(this: SparseMap<K, V>, key: K, value: () => Promise<V>): Promise<void> {
    return this.setLazy(key, Observable.defer(() => Observable.fromPromise(value())));
  }
}

class InMemorySparseMap<K, V> implements SparseMap<K, V> {
  private _latest: Map<K, Updatable<V>>;
  private _factory: ((key: K, hint?: any) => Observable<V>) | undefined;
  private _strategy: MergeStrategy;

  constructor(factory: ((key: K, hint?: any) => Observable<V>) | undefined = undefined, strategy: MergeStrategy = 'overwrite') {
    this._latest = new Map();
    this._factory = factory;
    this._strategy = strategy;
  }

  listen(key: K, hint?: any): Updatable<V> {
    let ret = this._latest.get(key);
    if (ret) return ret;

    if (this._factory) {
      let fact = this._factory.bind(this);
      ret = new Updatable<V>(() => fact(key, hint), this._strategy);
    } else {
      ret = new Updatable<V>(undefined, this._strategy);
    }

    this._latest.set(key, ret);
    return ret;
  }

  listenAll(): Map<K, Updatable<V>> {
    let ret = new Map<K, Updatable<V>>();
    for (let k of this._latest.keys()) {
      ret.set(k, this._latest.get(k)!);
    }

    return ret;
  }

  setDirect(key: K, value: Updatable<V>): Promise<void> {
    let prev = this._latest.get(key);
    if (prev) prev.playOnto(Observable.empty());

    this._latest.set(key, value);
    return Promise.resolve();
  }

  setLazy(key: K, value: Observable<V>): Promise<void> {
    this.listen(key).playOnto(value);
    return Promise.resolve();
  }

  invalidate(key: K): Promise<void> {
    let val = this._latest.get(key);
    if (val) {
      // Release whatever subscription val's playOnto is holding currently
      val.playOnto(Observable.empty());
      this._latest.delete(key);
    }

    return Promise.resolve();
  }
}

class LRUSparseMap<V> implements SparseMap<string, V> {
  private _latest: LRU.Cache<Updatable<V>>;
  private _factory: ((key: string, hint?: any) => Observable<V>) | undefined;
  private _strategy: MergeStrategy;

  constructor(
      factory: ((key: string, hint?: any) => Observable<V>) | undefined = undefined,
      strategy: MergeStrategy = 'overwrite',
      options?: LRU.Options<Updatable<V>>) {

    let opts = options || {max: 100};
    let disp = (_k: string, v: Updatable<V>) => {
      v.playOnto(Observable.empty());
    }

    if (opts.dispose) {
      let oldDisp = opts.dispose;
      opts.dispose = (k, v) => { disp(k, v); oldDisp(k, v); };
    } else {
      opts.dispose = disp;
    }

    this._latest = LRU<Updatable<V>>(opts);

    this._factory = factory;
    this._strategy = strategy;
  }

  listen(key: string, hint?: any): Updatable<V> {
    let ret = this._latest.get(key);
    if (ret) return ret;

    if (this._factory) {
      let fact = this._factory.bind(this);
      ret = new Updatable<V>(() => fact(key, hint), this._strategy);
    } else {
      ret = new Updatable<V>(undefined, this._strategy);
    }

    this._latest.set(key, ret);
    return ret;
  }

  listenAll(): Map<string, Updatable<V>> {
    let ret = new Map<string, Updatable<V>>();
    for (let k of this._latest.keys()) {
      ret.set(k, this.listen(k));
    }

    return ret;
  }

  setDirect(key: string, value: Updatable<V>): Promise<void> {
    let prev = this._latest.get(key);
    if (prev) prev.playOnto(Observable.empty());

    this._latest.set(key, value);
    return Promise.resolve();
  }

  setLazy(key: string, value: Observable<V>): Promise<void> {
    this.listen(key).playOnto(value);
    return Promise.resolve();
  }

  invalidate(key: string): Promise<void> {
    let val = this._latest.get(key);
    if (val) {
      // Release whatever subscription val's playOnto is holding currently
      val.playOnto(Observable.empty());
      this._latest.del(key);
    }

    return Promise.resolve();
  }
}

InMemorySparseMap.prototype = Object.assign(InMemorySparseMap.prototype, SparseMapMixins);
LRUSparseMap.prototype = Object.assign(LRUSparseMap.prototype, SparseMapMixins);

export { InMemorySparseMap, LRUSparseMap };