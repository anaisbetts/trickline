import * as debug from 'debug';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';
import { Subject } from 'rxjs/Subject';
import { Observable } from 'rxjs/Observable';

import { SerialSubscription } from './serial-subscription';

import './standard-operators';

export interface CreateSelector<TRet> { (): TRet; };
export interface CreateAsyncSelector<TRet> { (): Observable<TRet>|Promise<TRet>; };
export interface ActionCtor<TRet> {
  new(func: any, initialValue: TRet): Action<TRet>;
}

const d = debug('trickline:action');

export class Action<T> {
  private readonly executeFactory: CreateAsyncSelector<T>;
  private readonly resultSubject: BehaviorSubject<T>;
  private readonly thrownErrorsSubject: Subject<Error>;
  private readonly inflightRequest: SerialSubscription;
  private currentExecution: Observable<T> | null;

  static create<TRet>(func: CreateSelector<TRet>, initialValue: TRet): Action<TRet> {
    return Action.createAsync(() => Observable.of(func()), initialValue);
  }

  static createAsync<TRet>(this: ActionCtor<TRet>, func: CreateAsyncSelector<TRet>, initialValue: TRet): Action<TRet> {
    return new this(func, initialValue);
  }

  constructor(func: CreateAsyncSelector<T>, initialValue: T) {
    this.executeFactory = func;
    this.resultSubject = new BehaviorSubject(initialValue);
    this.thrownErrorsSubject = new Subject();
    this.inflightRequest = new SerialSubscription();
    this.currentExecution = null;
  }

  bind(): Function {
    return () => this.execute();
  }

  execute(): Observable<T> {
    if (this.currentExecution) return this.currentExecution;

    let result: ConnectableObservable<T>;
    d('Executing Action!');

    try {
      result = Observable.from(this.executeFactory()).publish();
    } catch (e) {
      this.thrownErrorsSubject.next(e);
      return Observable.throw(e);
    }

    result
      .finally(() => this.currentExecution = null)
      .subscribe(
        this.resultSubject.next.bind(this.resultSubject),
        this.thrownErrorsSubject.next.bind(this.thrownErrorsSubject));

    this.currentExecution = result;
    this.inflightRequest.set(result.connect());
    return result;
  }

  get isExecuting() { return this.currentExecution !== null; }
  get result(): Observable<T> { return this.resultSubject; }
  get thrownErrors(): Observable<Error> { return this.thrownErrorsSubject; }
}