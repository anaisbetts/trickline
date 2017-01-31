import { Observable, Subject } from 'rxjs/Rx';
import * as React from 'react';

export interface AttachedLifecycle<P, S> {
  lifecycle: Lifecycle<P, S>;
}

export abstract class Lifecycle<P, S> {
  willMount: Observable<void>;
  didMount: Observable<void>;
  willReceiveProps: Observable<P>;
  willUpdate: Observable<{props: P, state: S}>;
  didUpdate: Observable<{props: P, state: S}>;
  willUnmount: Observable<void>;

  public static attach<P, S>(target: React.Component<P, S>): Lifecycle<P, S> {
    return new ReactLifecycle(target);
  }
}

class ReactLifecycle<P, S> extends Lifecycle<P, S> {
  willMountSubj: Subject<void>;
  didMountSubj: Subject<void>;
  willReceivePropsSubj: Subject<P>;
  willUpdateSubj: Subject<{props: P, state: S}>;
  didUpdateSubj: Subject<{props: P, state: S}>;
  willUnmountSubj: Subject<void>;

  static reactMethodName(name: string): string {
    return 'component' + name.substr(0, 1).toUpperCase() + name.substr(1);
  }

  constructor(target: React.Component<P, S>) {
    super();

    for (const name of ['willMount', 'didMount', 'willUnmount']) {
      const subj = this[name + 'Subj'];
      target[ReactLifecycle.reactMethodName(name)] = () => subj.next(null);
    }

    for (const name of ['willUpdate', 'didUpdate']) {
      const subj = this[name + 'Subj'];
      target[ReactLifecycle.reactMethodName(name)] = (p: P, s: S) => subj.next({props: p, state: s});
    }

    const ps = this.willReceivePropsSubj;
    target['componentWillReceiveProps'] = (props: P) => ps.next(props);
  }
}