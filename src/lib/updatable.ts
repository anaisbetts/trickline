import { Observable } from 'rxjs/Observable';
import { Subscriber } from 'rxjs/Subscriber';
import { Subscription, ISubscription } from 'rxjs/Subscription';
import { SerialSubscription } from './serial-subscription';

import { Subject } from 'rxjs/Subject';

import './standard-operators';

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
    this._hasPendingValue = true;
    super.next(this._value = value);
  }

  invalidate() {
    this._hasPendingValue = false;
    this._playOnto.set(Subscription.EMPTY);
  }

  playOnto(source: Observable<T>) {
    this._playOnto.set(source.subscribe(this.next.bind(this), this.error.bind(this)));
  }
}
