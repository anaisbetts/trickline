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
    return this.getValue();
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

  getValue(): T {
    if (!this._hasPendingValue) {
      this.playOnto(this._factory());
    }

    if (this.hasError) {
      throw this.thrownError;
    } else {
      return this._value;
    }
  }

  next(value: T): void {
    super.next(this._value = value);
  }

  invalidate() {
    this._hasPendingValue = false;
  }

  playOnto(source: Observable<T>) {
    this._hasPendingValue = true;
    this._playOnto.set(source.subscribe(this.next.bind(this), this.error.bind(this)));
  }
}

export interface SparseMap<K, V> {
  subscribe(key: K): Updatable<V>;
  subscribeMany(keys: Array<K>): Map<K, Updatable<V>>;
  subscribeAll(): Map<K, Updatable<V>>;

  setLazy(key: K, value: Observable<V>): Promise<void>;
  invalidate(key: K): Promise<void>;
};

export class SparseMapMixins {
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

  static set<K, V>(this: SparseMap<K, V>, key: K, value: V): Promise<void> {
    return this.setLazy(key, Observable.of(value));
  }

  static setPromise<K, V>(this: SparseMap<K, V>, key: K, value: () => Promise<V>): Promise<void> {
    return this.setLazy(key, Observable.defer(() => Observable.fromPromise(value())));
  }
}

class InMemorySparseMap<K, V> implements SparseMap<K, V> {
}

InMemorySparseMap.prototype = Object.assign(InMemorySparseMap.prototype, SparseMapMixins);

export { InMemorySparseMap };