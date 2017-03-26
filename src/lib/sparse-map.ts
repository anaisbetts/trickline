import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';
import { Updatable, MergeStrategy, ArrayUpdatable } from './updatable';
import { Pair } from './utils';

import * as LRU from 'lru-cache';

import './standard-operators';

export interface SparseMap<K, V> {
  listen(key: K, hint?: any, dontCreate?: boolean): Updatable<V> | null;
  listenAll(): Map<K, Updatable<V>>;

  setDirect(key: K, value: Updatable<V>): Promise<void>;
  setAsync(key: K, value: Promise<V>): Promise<void>;
  invalidate(key: K): Promise<void>;

  created: Observable<Pair<K, Updatable<V>>>;
  evicted: Observable<Pair<K, Updatable<V>>>;
};

export class SparseMapMixins {
  static listenMany<K, V>(this: SparseMap<K, V>, keys: Array<K>, hint?: any, dontCreate?: boolean): Map<K, Updatable<V> | null> {
    return keys.reduce((acc, x) => {
      acc.set(x, this.listen(x, hint, dontCreate));
      return acc;
    }, new Map<K, Updatable<V> | null>());
  }

  static get<K, V>(this: SparseMap<K, V>, key: K, hint?: any, dontCreate?: boolean): Promise<V|null> {
    let ret = this.listen(key, hint, dontCreate);
    if (!ret) return Promise.resolve(null);

    return ret.take(1).toPromise();
  }

  static getMany<K, V>(this: SparseMap<K, V>, keys: Array<K>, hint?: any, dontCreate?: boolean): Promise<Map<K, V>> {
    return Observable.of(...keys)
      .flatMap(k => {
        let ret = this.listen(k, hint, dontCreate);
        if (!ret) return Observable.empty();

        return ret.take(1).map(v => ({Key: k, Value: v}));
      })
      .reduce((acc, x) => {
        acc.set(x.Key, x.Value);
        return acc;
      }, new Map<K, V>())
      .toPromise();
  }

  static setValue<K, V>(this: SparseMap<K, V>, key: K, value: V): Promise<void> {
    this.listen(key).next(value);
    return Promise.resolve();
  }
}

class InMemorySparseMap<K, V> implements SparseMap<K, V> {
  created: Subject<Pair<K, Updatable<V>>>;
  evicted: Subject<Pair<K, Updatable<V>>>;

  private _latest: Map<K, Updatable<V>>;
  private _factory: ((key: K, hint?: any) => Promise<V>) | undefined;
  private _strategy: MergeStrategy;

  constructor(factory: ((key: K, hint?: any) => Promise<V>) | undefined = undefined, strategy: MergeStrategy = 'overwrite') {
    this._latest = new Map();
    this._factory = factory;
    this._strategy = strategy;

    this.created = new Subject();
    this.evicted = new Subject();
  }

  listen(key: K, hint?: any, dontCreate?: boolean): Updatable<V> | null {
    let ret = this._latest.get(key);
    if (ret) return ret;
    if (!ret && dontCreate) return null;

    if (this._factory) {
      let fact = this._factory.bind(this);
      if (this._strategy === 'array') {
        ret = new ArrayUpdatable(() => fact(key, hint));
      } else {
        ret = new Updatable<V>(() => fact(key, hint), this._strategy);
      }
    } else {
      if (this._strategy === 'array') {
        ret = new ArrayUpdatable();
      } else {
        ret = new Updatable<V>(undefined, this._strategy);
      }
    }

    this._latest.set(key, ret!);
    this.created.next({ Key: key, Value: ret! });
    return ret!;
  }

  listenAll(): Map<K, Updatable<V>> {
    let ret = new Map<K, Updatable<V>>();
    for (let k of this._latest.keys()) {
      ret.set(k, this._latest.get(k)!);
    }

    return ret;
  }

  setDirect(key: K, value: Updatable<V>): Promise<void> {
    this._latest.set(key, value);
    return Promise.resolve();
  }

  async setAsync(key: K, value: Promise<V>): Promise<void> {
    this.listen(key).next(await value);
  }

  invalidate(key: K): Promise<void> {
    let val = this._latest.get(key);
    if (val) {
      this._latest.delete(key);
      this.evicted.next({ Key: key, Value: val });
    }

    return Promise.resolve();
  }

  /*** BEGIN COPYPASTA ***/
   listenMany(keys: Array<K>, hint?: any, dontCreate?: boolean): Map<K, Updatable<V>> {
    return keys.reduce((acc, x) => {
      acc.set(x, this.listen(x, hint, dontCreate));
      return acc;
    }, new Map<K, Updatable<V>>());
  }

  get(key: K, hint?: any, dontCreate?: boolean): Promise<V|null> {
    let ret = this.listen(key, hint, dontCreate);
    if (!ret) return Promise.resolve(null);

    return ret.waitForValue();
  }

  getMany(keys: Array<K>, hint?: any, dontCreate?: boolean): Promise<Map<K, V|null>> {
    return Observable.of(...keys)
      .flatMap(k => {
        let ret = this.listen(k, hint, dontCreate);
        if (!ret) return Observable.empty();

        return ret.take(1).map(v => ({Key: k, Value: v}));
      })
      .reduce((acc, x) => {
        acc.set(x.Key, x.Value);
        return acc;
      }, new Map<K, V>())
      .toPromise();
  }

  setValue(key: K, value: V): Promise<void> {
    this.listen(key).next(value);
    return Promise.resolve();
  }
  /*** END COPYPASTA ***/
}

class LRUSparseMap<V> implements SparseMap<string, V> {
  private _latest: LRU.Cache<Updatable<V>>;
  private _factory: ((key: string, hint?: any) => Promise<V>) | undefined;
  private _strategy: MergeStrategy;

  created: Subject<Pair<string, Updatable<V>>>;
  evicted: Subject<Pair<string, Updatable<V>>>;

  constructor(
      factory: ((key: string, hint?: any) => Promise<V>) | undefined = undefined,
      strategy: MergeStrategy = 'overwrite',
      options?: LRU.Options<Updatable<V>>) {
    this.created = new Subject();
    this.evicted = new Subject();

    let opts = options || {max: 100};

    if (opts.dispose) {
      throw new Error("Don't set dispose, use the evicted observable");
    }

    opts.dispose = (k, v) => { this.evicted.next({Key: k, Value: v}); };

    this._latest = LRU<Updatable<V>>(opts);

    this._factory = factory;
    this._strategy = strategy;
  }

  listen(key: string, hint?: any, dontCreate?: boolean): Updatable<V> | null {
    let ret = this._latest.get(key);
    if (ret) return ret;
    if (!ret && dontCreate) return null;

    if (this._factory) {
      let fact = this._factory.bind(this);
      if (this._strategy === 'array') {
        ret = new ArrayUpdatable(() => fact(key, hint));
      } else {
        ret = new Updatable<V>(() => fact(key, hint), this._strategy);
      }
    } else {
      if (this._strategy === 'array') {
        ret = new ArrayUpdatable();
      } else {
        ret = new Updatable<V>(undefined, this._strategy);
      }
    }

    this._latest.set(key, ret);
    this.created.next({ Key: key, Value: ret });
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
    this._latest.set(key, value);
    return Promise.resolve();
  }

  async setAsync(key: string, value: Promise<V>): Promise<void> {
    this.listen(key).next(await value);
  }

  invalidate(key: string): Promise<void> {
    let val = this._latest.get(key);
    if (val) { this._latest.del(key); }

    return Promise.resolve();
  }

  /*** BEGIN COPYPASTA ***/
   listenMany(keys: Array<string>, hint?: any, dontCreate?: boolean): Map<string, Updatable<V>> {
    return keys.reduce((acc, x) => {
      acc.set(x, this.listen(x, hint, dontCreate));
      return acc;
    }, new Map<string, Updatable<V>>());
  }

  get(key: string, hint?: any, dontCreate?: boolean): Promise<V|null> {
    let ret = this.listen(key, hint, dontCreate);
    if (!ret) return Promise.resolve(null);

    return ret.waitForValue();
  }

  getMany(keys: Array<string>, hint?: any, dontCreate?: boolean): Promise<Map<string, V|null>> {
    return Observable.of(...keys)
      .flatMap(k => {
        let ret = this.listen(k, hint, dontCreate);
        if (!ret) return Observable.empty();

        return ret.take(1).map(v => ({Key: k, Value: v}));
      })
      .reduce((acc, x) => {
        acc.set(x.Key, x.Value);
        return acc;
      }, new Map<string, V>())
      .toPromise();
  }

  setValue(key: string, value: V): Promise<void> {
    this.listen(key).next(value);
    return Promise.resolve();
  }
  /*** END COPYPASTA ***/
}

export { InMemorySparseMap, LRUSparseMap };
