import { Observable } from 'rxjs/Observable';
import { Subscriber } from 'rxjs/Subscriber';
import { Subscription, ISubscription } from 'rxjs/Subscription';

import { SerialSubscription } from './serial-subscription';
import { observeArray } from './when';
import * as debug from 'debug';

import { captureStack } from './utils';

import { Subject } from 'rxjs/Subject';

import './standard-operators';

export type MergeStrategy = 'overwrite' | 'merge';

const d = debug('trickline:updatable');

export class Updatable<T> extends Subject<T> {
  protected _value: T;
  protected _hasPendingValue: boolean;
  protected _factory?: () => (Promise<T>|Observable<T>);
  protected _errFunc: ((e: Error) => void);
  protected _nextFunc: ((x: T) => void);
  protected _innerSub: Subscription;

  constructor(factory?: () => (Promise<T>|Observable<T>), strategy?: MergeStrategy) {
    super();

    this._hasPendingValue = false;
    this._factory = factory;
    this._innerSub = new Subscription();

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

  protected nextOverwrite(value: T): void {
    this._hasPendingValue = true;
    super.next(this._value = value);
  }

  protected nextMerge(value: T): void {
    if (value === undefined) {
      d(`Updatable with merge strategy received undefined, this is probably a bug\n${captureStack()}`);
      return;
    }

    this._hasPendingValue = true;

    if (this._value) {
      this._value = Object.assign({}, this._value || {}, value || {});
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
    this._hasPendingValue = true;

    if ('then' in source) {
      (source as Promise<T>).then(this._nextFunc, this._errFunc);
    } else {
      (source as Observable<T>).take(1).subscribe(this._nextFunc, this._errFunc);
    }
  }

  addTeardown(teardown: ISubscription | Function) {
    this._innerSub.add(teardown);
  }

  unsubscribe() {
    super.unsubscribe();
    this._innerSub.unsubscribe();
  }

  get(): Promise<T> {
    return this.take(1).toPromise();
  }
}

export class ArrayUpdatable<T> extends Updatable<T[]> {
  readonly arraySub: SerialSubscription;

  constructor(factory?: () => (Promise<T[]>|Observable<T[]>)) {
    super(factory);
    this.arraySub = new SerialSubscription();
    this._innerSub.add(this.arraySub);
  }

  nextOverwrite(value: T[]): void {
    this._hasPendingValue = true;
    super.next(Array.from(this._value = value));

    this.arraySub.set(
      observeArray(value).subscribe(() => super.next(Array.from(value))));
  }
}