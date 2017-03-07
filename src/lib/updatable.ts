import { Observable } from 'rxjs/Observable';
import { Subscriber } from 'rxjs/Subscriber';
import { Subscription, ISubscription } from 'rxjs/Subscription';
import * as debug from 'debug';

import { captureStack } from './utils';

import { Subject } from 'rxjs/Subject';

import './standard-operators';

export type Pair<K, V> = { Key: K, Value: V };
export type MergeStrategy = 'overwrite' | 'merge';

const d = debug('trickline:updatable');

export class Updatable<T> extends Subject<T> {
  private _value: T;
  private _hasPendingValue: boolean;
  private _factory?: () => (Promise<T>|Observable<T>);
  private _errFunc: ((e: Error) => void);
  private _nextFunc: ((x: T) => void);

  pinned: boolean;

  constructor(factory?: () => (Promise<T>|Observable<T>), strategy?: MergeStrategy) {
    super();

    this._hasPendingValue = false;
    this._factory = factory;
    this.pinned = false;

    switch (strategy || 'overwrite') {
    case 'overwrite':
      this.next = this.nextOverwrite;
      break;
    case 'merge':
      this.next = this.nextMerge;
      break;
    }

    this._nextFunc = this.next.bind(this);
    this._errFunc = this.error.bind(this);
  }

  get value(): T {
    if (!this._hasPendingValue && this._factory) {
      this.nextAsync(this._factory());
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
    if (!this._hasPendingValue && this._factory) {
      this.nextAsync(this._factory());
      shouldNext = false;
    }

    if (subscription && shouldNext && !(<ISubscription>subscription).closed) {
      subscriber.next(this._value);
    }

    return subscription;
  }

  nextOverwrite(value: T): void {
    this._hasPendingValue = true;
    super.next(this._value = value);
  }

  nextMerge(value: T): void {
    if (value === undefined) {
      captureStack();
      d(`Updatable with merge strategy received undefined, this is probably a bug\n${captureStack()}`);
      return;
    }

    this._hasPendingValue = true;

    if (this._value) {
      this._value = Object.assign(this._value || {}, value || {});
    } else {
      this._value = value;
    }

    super.next(this._value);
  }

  error(error: any) {
    d(`Updatable threw error: ${error.message}\nCurrent value is ${JSON.stringify(this._value)}\n${error.stack}`);
    super.error(error);
  }

  invalidate() {
    this._hasPendingValue = false;
    delete this._value;

    if (this._factory) {
      this.nextAsync(this._factory());
    }
  }

  nextAsync(source: (Promise<T>|Observable<T>)) {
    if ('then' in source) {
      source.then(
        (x) => this.next(x),
        (e) => this.error(e));
    } else {
      source.take(1).subscribe(this._nextFunc, this._errFunc);
    }
  }
}