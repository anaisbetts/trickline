import { Observable, AsyncSubject, Subject } from 'rxjs/Rx';
import * as React from 'react';

export interface AttachedLifecycle<P, S> {
  lifecycle: Lifecycle<P, S>;
}

export abstract class Lifecycle<P, S> {
  willMount: Observable<boolean>;
  didMount: Observable<boolean>;
  willReceiveProps: Observable<P>;
  willUpdate: Observable<{props: P, state: S}>;
  didUpdate: Observable<{props: P, state: S}>;
  willUnmount: Observable<boolean>;

  public static attach<P, S>(target: React.Component<P, S>): Lifecycle<P, S> {
    return new ReactLifecycle(target);
  }
}

class ReactLifecycle<P, S> extends Lifecycle<P, S> {
  willMountSubj: AsyncSubject<boolean>;
  didMountSubj: AsyncSubject<boolean>;
  willReceivePropsSubj: Subject<P>;
  willUpdateSubj: Subject<{props: P, state: S}>;
  didUpdateSubj: Subject<{props: P, state: S}>;
  willUnmountSubj: AsyncSubject<boolean>;

  public get willMount() { return this.willMountSubj; }
  public get didMount() { return this.didMountSubj; }
  public get willReceiveProps() { return this.willReceivePropsSubj; }
  public get willUpdate() { return this.willUpdateSubj; }
  public get didUpdate() { return this.didUpdateSubj; }
  public get willUnmount() { return this.willUnmountSubj; }

  static reactMethodName(name: string): string {
    return 'component' + name.substr(0, 1).toUpperCase() + name.substr(1);
  }

  public constructor(target: React.Component<P, S>) {
    super();

    for (const name of ['willMount', 'didMount', 'willUnmount']) {
      const subj = this[name + 'Subj'] = new AsyncSubject();
      target[ReactLifecycle.reactMethodName(name)] = () => { subj.next(true); subj.complete(); };
    }

    for (const name of ['willUpdate', 'didUpdate']) {
      const subj = this[name + 'Subj'] = Subject.create();
      target[ReactLifecycle.reactMethodName(name)] = (p: P, s: S) => subj.next({props: p, state: s});
    }

    const ps = this.willReceivePropsSubj = Subject.create();
    target['componentWillReceiveProps'] = (props: P) => ps.next(props);
  }
}