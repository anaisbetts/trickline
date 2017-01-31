import { ConnectableObservable, Observable, BehaviorSubject, Subject, Subscription } from 'rxjs/Rx';
import { SerialSubscription } from './serial-subscription';
import { AttachedLifecycle } from './view';

export interface CreateSelector<TRet> { (): TRet; };
export interface CreateAsyncSelector<TRet> { (): Observable<TRet>|Promise<TRet>; };
export interface ActionCtor<TRet> {
  new(func: any): Action<TRet>;
}

export class Action<T> {
  executeFactory: CreateAsyncSelector<T>;
  resultSubject: BehaviorSubject<T>;
  thrownErrorsSubject: Subject<Error>;
  inflightRequest: SerialSubscription;
  currentExecution: Observable<T> | null;

  public static create<TRet>(func: CreateSelector<TRet>): Action<TRet> {
    return Action.createAsync(() => Observable.of(func()));
  }

  public static createAsync<TRet>(this: ActionCtor<TRet>, func: CreateAsyncSelector<TRet>): Action<TRet> {
    return new this(func);
  }

  public toState<P, S, K extends keyof S>(target: React.Component<P, S> & AttachedLifecycle<P, S>, name: K): Subscription {
    return this.result
      .takeUntil(target.lifecycle.willUnmount)
      .finally(() => this.inflightRequest.unsubscribe())
      .subscribe(newVal => {
        const next: any = {};
        next[name] = newVal;

        target.setState(next);
      });
  }

  public bind(): Function {
    return () => this.execute();
  }

  public execute(): Observable<T> {
    if (this.currentExecution) return this.currentExecution;
    let result: ConnectableObservable<T>;

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

  public constructor(func: CreateAsyncSelector<T>) {
    this.executeFactory = func;
    this.resultSubject = BehaviorSubject.create();
    this.thrownErrorsSubject = Subject.create();
    this.inflightRequest = new SerialSubscription();
    this.currentExecution = null;
  }
}