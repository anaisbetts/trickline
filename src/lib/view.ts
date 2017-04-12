import { Observable } from 'rxjs/Observable';
import { AsyncSubject } from 'rxjs/AsyncSubject';
import { Subscription } from 'rxjs/Subscription';
import { Subject } from 'rxjs/Subject';

import * as isFunction from 'lodash.isfunction';
import * as React from 'react';

import { Model } from './model';
import { detectTestRunner } from './utils';

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

      if (name === 'willUnmount') {
        target[AttachedReactLifecycle.reactMethodName(name)] = function() { subj.next(true); subj.complete(); };

        for (const unsubName of ['willUpdate', 'didUpdate', 'willReceiveProps']) {
          target[unsubName].complete();
        }
      } else {
        target[AttachedReactLifecycle.reactMethodName(name)] = function() { subj.next(true); subj.complete(); };
      }
    }

    for (const name of ['willUpdate', 'didUpdate']) {
      const subj = this[name + 'Subj'] = Subject.create();
      target[AttachedReactLifecycle.reactMethodName(name)] = function(p: P, s: S) { subj.next({props: p, state: s}); };
    }

    const ps = this.willReceivePropsSubj = Subject.create();
    target['componentWillReceiveProps'] = function(props: P) { ps.next(props); };
  }
}

export class ExplicitLifecycle<P, S> extends Lifecycle<P, S> {
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
  customUpdateFunc: () => void;
  viewModel: T | null;

  constructor(props?: P, context?: any) {
    super(props, context);
    this.lifecycle = new ExplicitLifecycle<P, null>();

    if (View.isInTestRunner === undefined) {
      View.isInTestRunner = detectTestRunner();
    }

    if (props) this.viewModel = props.viewModel;

    const customUpdater = this.customUpdateFunc ?
      this.customUpdateFunc.bind(this) :
      null;

    this.lifecycle.didMount.map(() => null).concat(this.lifecycle.willReceiveProps)
      .do(p => this.viewModel = p ? p.viewModel : this.viewModel)
      .switchMap(() => this.viewModel ? this.viewModel.changed : Observable.never())
      .takeUntil(this.lifecycle.willUnmount)
      .subscribe(() => { if (this.viewModel) { this.queueUpdate(customUpdater); } });

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

    if (this.lifecycle.willReceivePropsSubj) this.lifecycle.willReceivePropsSubj.complete();
    if (this.lifecycle.willUpdateSubj) this.lifecycle.willUpdateSubj.complete();
    if (this.lifecycle.didUpdateSubj) this.lifecycle.didUpdateSubj.complete();
  }

  private static toUpdate: (View<any, any> | Function)[];
  private static currentRafToken: number;
  private static isInFocus: boolean;
  private static isInFocusSub: Subscription;
  static isInTestRunner: boolean | undefined;

  private static seenViews: Set<any>;
  static dispatchUpdates() {
    View.seenViews = View.seenViews || new Set();
    View.seenViews.clear();

    const ourViews = View.toUpdate.reduceRight((acc: any[], x) => {
      if (!View.seenViews.has(x)) acc.push(x);
      return acc;
    }, []);

    View.toUpdate = [];
    View.currentRafToken = 0;

    for (let i = 0; i < ourViews.length; i++) {
      if (isFunction(ourViews[i])) {
        (ourViews[i] as Function)();
        continue;
      } else {
        const current = ourViews[i] as View<any, any>;
        if (!current.viewModel) continue;

        current.forceUpdate();
      }
    }
  }

  protected queueUpdate(updater?: Function) {
    View.toUpdate = View.toUpdate || [];
    View.toUpdate.push(updater || this);

    if (!View.isInFocusSub) {
      View.isInFocusSub = Observable.fromEvent(window, 'focus').subscribe(() => {
        // NB: If the window loses focus, then comes back, there could
        // be an up-to-750ms delay between the window regaining focus
        // and the idle setTimeout actually running. That's bad, we will
        // instead cancel our lazy timer and fire a quick one
        if (View.currentRafToken) {
          clearTimeout(View.currentRafToken);
          this.queueUpdate();
        }
      });
    }

    if (isInTestRunner) {
      View.dispatchUpdates();
    }

    if (View.currentRafToken === 0 || View.currentRafToken === undefined) {
      View.currentRafToken = document.hasFocus() ?
        requestAnimationFrame(View.dispatchUpdates) :
        window.setTimeout(View.dispatchUpdates, 20);
    }
  }
}

export abstract class SimpleView<T extends Model> extends View<T, { viewModel: T }> {
}