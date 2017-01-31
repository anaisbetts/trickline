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

  static attach<P, S>(target: React.Component<P, S>): Lifecycle<P, S> {
    return new ReactLifecycle(target);
  }
}

class ReactLifecycle<P, S> extends Lifecycle<P, S> {
  private readonly willMountSubj: AsyncSubject<boolean>;
  private readonly didMountSubj: AsyncSubject<boolean>;
  private readonly willReceivePropsSubj: Subject<P>;
  private readonly willUpdateSubj: Subject<{props: P, state: S}>;
  private readonly didUpdateSubj: Subject<{props: P, state: S}>;
  private readonly willUnmountSubj: AsyncSubject<boolean>;

  get willMount() { return this.willMountSubj; }
  get didMount() { return this.didMountSubj; }
  get willReceiveProps() { return this.willReceivePropsSubj; }
  get willUpdate() { return this.willUpdateSubj; }
  get didUpdate() { return this.didUpdateSubj; }
  get willUnmount() { return this.willUnmountSubj; }

  private static reactMethodName(name: string): string {
    return 'component' + name.substr(0, 1).toUpperCase() + name.substr(1);
  }

  constructor(target: React.Component<P, S>) {
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

export abstract class View<P> extends React.PureComponent<P, null> implements AttachedLifecycle<P, null> {
  readonly lifecycle: Lifecycle<P, null>;

  constructor(props?: any, context?: any) {
    super(props, context);
    this.lifecycle = Lifecycle.attach(this);
  }
}