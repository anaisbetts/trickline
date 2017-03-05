import { Observable } from 'rxjs/Observable';
import { AsyncSubject } from 'rxjs/AsyncSubject';
import { Subscription } from 'rxjs/Subscription';
import { Subject } from 'rxjs/Subject';
import { asap } from 'rxjs/scheduler/asap';

import * as React from 'react';

import { Model } from './model';

import './standard-operators';

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
    return new AttachedReactLifecycle(target);
  }
}

class AttachedReactLifecycle<P, S> extends Lifecycle<P, S> {
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
      target[AttachedReactLifecycle.reactMethodName(name)] = () => { subj.next(true); subj.complete(); };
    }

    for (const name of ['willUpdate', 'didUpdate']) {
      const subj = this[name + 'Subj'] = Subject.create();
      target[AttachedReactLifecycle.reactMethodName(name)] = (p: P, s: S) => subj.next({props: p, state: s});
    }

    const ps = this.willReceivePropsSubj = Subject.create();
    target['componentWillReceiveProps'] = (props: P) => ps.next(props);
  }
}

class ReactLifecycle<P, S> extends Lifecycle<P, S> {
  willMountSubj: AsyncSubject<boolean>;
  didMountSubj: AsyncSubject<boolean>;
  willReceivePropsSubj: Subject<P>;
  willUpdateSubj: Subject<{props: P, state: S}>;
  didUpdateSubj: Subject<{props: P, state: S}>;
  willUnmountSubj: AsyncSubject<boolean>;

  get willMount() { return (this.willMountSubj = this.willMountSubj || new AsyncSubject()); }
  get didMount() { return (this.didMountSubj = this.didMountSubj || new AsyncSubject()); }
  get willReceiveProps() { return (this.willReceivePropsSubj = this.willReceivePropsSubj || new Subject()); }
  get willUpdate() { return (this.willUpdateSubj = this.willUpdateSubj || new Subject()); }
  get didUpdate() { return (this.didUpdateSubj = this.didUpdateSubj || new Subject()); }
  get willUnmount() { return (this.willUnmountSubj = this.willUnmountSubj || new AsyncSubject()); }
}

export interface HasViewModel<T extends Model> {
  viewModel: T;
}

export abstract class View<T extends Model, P extends HasViewModel<T>>
    extends React.PureComponent<P, null>
    implements AttachedLifecycle<P, null> {
  readonly lifecycle: Lifecycle<P, null>;
  viewModel: T;

  constructor(props?: P, context?: any) {
    super(props, context);
    if (props) this.viewModel = props.viewModel;

    this.lifecycle = new ReactLifecycle<P, null>();

    this.lifecycle.didMount
      .flatMap(() => this.viewModel.changed)
      .takeUntil(this.lifecycle.willUnmount)
      .observeOn(asap)
      .subscribe(() => { if (this.viewModel) { this.queueUpdate(); } });

    this.lifecycle.willUnmount.subscribe(() => { if (this.viewModel) this.viewModel.unsubscribe(); this.viewModel = null; });
  }

  componentWillMount() {
    if (!this.lifecycle.willMountSubj) return;
    this.lifecycle.willMountSubj.next(true);
    this.lifecycle.willMountSubj.complete();
  }

  componentDidMount() {
    if (!this.lifecycle.didMountSubj) return;
    this.lifecycle.didMountSubj.next(true);
    this.lifecycle.didMountSubj.complete();
  }

  componentWillReceiveProps(props: P) {
    if (!this.lifecycle.willReceivePropsSubj) return;
    this.lifecycle.willReceivePropsSubj.next(props);
  }

  componentWillUpdate(props: P) {
    if (!this.lifecycle.willUpdateSubj) return;
    this.lifecycle.willUpdateSubj.next({props, state: {}});
  }

  componentDidUpdate(props: P) {
    if (!this.lifecycle.didUpdateSubj) return;
    this.lifecycle.didUpdateSubj.next({props, state: {}});
  }

  componentWillUnmount() {
    if (!this.lifecycle.willUnmountSubj) return;
    this.lifecycle.willUnmountSubj.next(true);
    this.lifecycle.willUnmountSubj.complete();
  }

  static toUpdate: View<any, any>[];
  static currentRafToken: number;
  static isInFocus: boolean;
  static isInFocusSub: Subscription;
  static isForceUpdating: boolean;
  hasBeenRendered: boolean;

  static dispatchUpdates() {
    const ourViews = View.toUpdate;
    View.toUpdate = [];

    View.currentRafToken = 0;
    View.isForceUpdating = true;

    try {
      for (let i = 0; i < ourViews.length; i++) {
        const current = ourViews[i];
        if (!current.viewModel || current.hasBeenRendered) continue;

        current.forceUpdate();
        current.hasBeenRendered = true;
      }
    } finally {
      for (let i = 0; i < ourViews.length; i++) { ourViews[i].hasBeenRendered = false; }
      View.isForceUpdating = false;
    }
  }

  private queueUpdate() {
    View.toUpdate = View.toUpdate || [];
    View.toUpdate.push(this);

    if (!View.isInFocusSub) {
      View.isInFocusSub = Observable.merge(
        Observable.fromEvent(window, 'blur').map(() => false),
        Observable.fromEvent(window, 'focus').map(() => true),
      ).subscribe(x => {
        View.isInFocus = x;

        // NB: If the window loses focus, then comes back, there could
        // be an up-to-750ms delay between the window regaining focus
        // and the idle setTimeout actually running. That's bad, we will
        // instead cancel our lazy timer and fire a quick one
        if (x && View.currentRafToken) {
          clearTimeout(View.currentRafToken);
          this.queueUpdate();
        }
      });
    }

    if (View.currentRafToken === 0 || View.currentRafToken === undefined) {
      View.currentRafToken = View.isInFocus ?
        requestAnimationFrame(View.dispatchUpdates) :
        window.setTimeout(View.dispatchUpdates, 750);
    }
  }
}

export abstract class SimpleView<T extends Model> extends View<T, { viewModel: T }> {
}