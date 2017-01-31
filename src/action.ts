import * as debug from 'debug';
import { ConnectableObservable, Observable, BehaviorSubject, Subject, Subscription } from 'rxjs';

import { SerialSubscription } from './serial-subscription';
import { AttachedLifecycle } from './view';

export interface CreateSelector<TRet> { (): TRet; };
export interface CreateAsyncSelector<TRet> { (): Observable<TRet>|Promise<TRet>; };
export interface ActionCtor<TRet> {
  new(func: any, initialValue: TRet): Action<TRet>;
}

const d = debug('trickline:action');

export class Action<T> {
  executeFactory: CreateAsyncSelector<T>;
  resultSubject: BehaviorSubject<T>;
  thrownErrorsSubject: Subject<Error>;
  inflightRequest: SerialSubscription;
  currentExecution: Observable<T> | null;

  public static create<TRet>(func: CreateSelector<TRet>, initialValue: TRet): Action<TRet> {
    return Action.createAsync(() => Observable.of(func()), initialValue);
  }

  public static createAsync<TRet>(this: ActionCtor<TRet>, func: CreateAsyncSelector<TRet>, initialValue: TRet): Action<TRet> {
    return new this(func, initialValue);
  }

  public toState<P, S, K extends keyof S>(target: React.Component<P, S> & AttachedLifecycle<P, S>, name: K): Subscription {
    target.state = target.state || {};

    return target.lifecycle.willMount
      .flatMap(() => this.result)
      .takeUntil(target.lifecycle.willUnmount)
      .finally(() => this.inflightRequest.unsubscribe())
      .subscribe(newVal => {
        const next: any = {};
        next[name] = newVal;

        d(`Setting ${name} => ${newVal}`);
        target.setState(next);
      });
  }

  public bind(): Function {
    return () => this.execute();
  }

  public execute(): Observable<T> {
    if (this.currentExecution) return this.currentExecution;
    let result: ConnectableObservable<T>;
    d('Executing Action!');

    try {
      result = Observable.from(this.executeFactory()).publish();
    } catch (e) {
      this.thrownErrorsSubject.next(e);
      return Observable.throw(e);
    }

    result.subscribe(
      this.resultSubject.next.bind(this.resultSubject),
      this.thrownErrorsSubject.error.bind(this.thrownErrorsSubject));

    result.subscribe(() => this.currentExecution = null);

    this.inflightRequest.set(result.connect());
    return result;
  }

  get result(): Observable<T> { return this.resultSubject; }
  get thrownErrors(): Observable<Error> { return this.thrownErrorsSubject; }

  public constructor(func: CreateAsyncSelector<T>, initialValue: T) {
    this.executeFactory = func;
    this.resultSubject = new BehaviorSubject(initialValue);
    this.thrownErrorsSubject = Subject.create();
    this.inflightRequest = new SerialSubscription();
    this.currentExecution = null;
  }
}