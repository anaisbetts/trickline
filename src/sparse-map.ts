import {Observable} from 'rxjs/Observable';
import {Subscriber} from 'rxjs/Subscriber';
import {Subscription, ISubscription} from 'rxjs/Subscription';
import {SerialSubscription} from './serial-subscription';

import {Subject} from 'rxjs/Subject';

export type Pair<K, V> = { Key: K, Value: V };

export class Updatable<T> extends Subject<T> {
  private _value: T;
  private _hasPendingValue: boolean;
  private _factory: () => Observable<T>;
  private _playOnto: SerialSubscription;

  constructor(factory?: () => Observable<T>) {
    super();

    this._hasPendingValue = false;
    this._factory = factory ? factory : () => Observable.empty();
    this._playOnto = new SerialSubscription();
  }

  get value(): T {
    if (!this._hasPendingValue) {
      this.playOnto(this._factory());
    }

    if (this.hasError) {
      throw this.thrownError;
    } else {
      return this._value;
    }
  }

  protected _subscribe(subscriber: Subscriber<T>): Subscription {
    const subscription = super._subscribe(subscriber);

    let shouldNext = true;
    if (!this._hasPendingValue) {
      this.playOnto(this._factory());
      shouldNext = false;
    }

    if (subscription && shouldNext && !(<ISubscription>subscription).closed) {
      subscriber.next(this._value);
    }

    return subscription;
  }

  next(value: T): void {
    super.next(this._value = value);
  }

  invalidate() {
    this._hasPendingValue = false;
    this._playOnto.set(Subscription.EMPTY);
  }

  playOnto(source: Observable<T>) {
    this._hasPendingValue = true;
    this._playOnto.set(source.subscribe(this.next.bind(this), this.error.bind(this)));
  }
}

export interface SparseMap<K, V> {
  subscribe(key: K): Updatable<V>;
  subscribeAll(): Map<K, Updatable<V>>;

  setDirect(key: K, value: Updatable<V>): Promise<void>;
  setLazy(key: K, value: Observable<V>): Promise<void>;
  invalidate(key: K): Promise<void>;
};

export class SparseMapMixins {
  static subscribeMany<K, V>(this: SparseMap<K, V>, keys: Array<K>): Map<K, Updatable<V>> {
    return keys.reduce((acc, x) => {
      acc.set(x, this.subscribe(x));
      return acc;
    }, new Map<K, Updatable<V>>());
  }

  static get<K, V>(this: SparseMap<K, V>, key: K): Promise<V> {
    return this.subscribe(key).take(1).toPromise();
  }

  static getMany<K, V>(this: SparseMap<K, V>, keys: Array<K>): Promise<Map<K, V>> {
    return Observable.of(...keys)
      .flatMap(k => this.subscribe(k).take(1).map(v => ({Key: k, Value: v})))
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
  private latest: Map<K, Updatable<V>>;
  private factory: (key: K) => Observable<V> | undefined;

  constructor(factory?: (key: K) => Observable<V> = undefined) {
    this.latest = new Map();
    this.factory = factory;
  }

  subscribe(key: K): Updatable<V> {
    let ret = this.latest.get(key);
    if (ret) return ret;

    if (this.factory) {
      ret = new Updatable<V>(() => this.factory(key));
    } else {
      ret = new Updatable<V>();
    }

    this.latest.set(key, ret);
    return ret;
  }

  subscribeAll(): Map<K, Updatable<V>> {
    let ret = new Map<K, Updatable<V>>();
    for (let k of this.latest.keys()) {
      ret.set(k, this.latest.get(k));
    }

    return ret;
  }

  setDirect(key: K, value: Updatable<V>): Promise<void> {
    let prev = this.latest.get(key);
    if (prev) prev.playOnto(Observable.empty());

    this.latest.set(key, value);
    return Promise.resolve();
  }

  setLazy(key: K, value: Observable<V>): Promise<void> {
    this.subscribe(key).playOnto(value);
    return Promise.resolve();
  }

  invalidate(key: K): Promise<void> {
    let val = this.latest.get(key);
    if (val) {
      val.playOnto(Observable.empty());
      this.latest.delete(key);
    }

    return Promise.resolve();
  }
}

InMemorySparseMap.prototype = Object.assign(InMemorySparseMap.prototype, SparseMapMixins);

export { InMemorySparseMap };