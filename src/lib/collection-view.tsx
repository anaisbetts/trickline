import { Subject } from 'rxjs/Subject';

import { Model } from './model';
import { Lifecycle, HasViewModel } from './view';
import { whenArray } from './when';
import * as LRU from 'lru-cache';

const d = require('debug')('trickline-test:collection-view');

export class ViewModelListHelper<T extends Model, P extends HasViewModel<T>, S> {
  readonly shouldRender: Subject<void>;

  private readonly keySelector: ((item: any) => string);
  private readonly viewModelCache: LRU.Cache<Model>;
  private readonly createViewModel: ((x: any, i: number) => Model);
  private currentItems: any[];

  constructor(
      lifecycle: Lifecycle<P, S>,
      props: P,
      itemsSelector: ((x: T) => any[]),
      keySelector: ((x: any) => string),
      createViewModel: ((x: any) => Model),
      lruOpts?: LRU.Options<Model>) {
    this.shouldRender = new Subject<void>();
    this.keySelector = keySelector;
    this.createViewModel = createViewModel;

    let opts = lruOpts || {max: 100};

    if (opts.dispose) {
      throw new Error("Don't set dispose, use the evicted observable");
    }

    opts.dispose = (_k: string, v: Model) => { v.unsubscribe(); };
    this.viewModelCache = LRU<Model>(opts);

    let initialVm = props.viewModel;
    let sub = lifecycle.didMount.map(() => ({ viewModel: initialVm })).concat(lifecycle.willReceiveProps)
      .switchMap(p => whenArray(p.viewModel, itemsSelector))
      .subscribe(v => {
        d(`Listening to new array via ${itemsSelector}`);
        this.currentItems = v.value;
        this.shouldRender.next();
      });

    lifecycle.willUnmount.subscribe(() => {
      this.viewModelCache.reset();
      this.shouldRender.unsubscribe();
      sub.unsubscribe();
    });
  }

  getViewModel(index: number) {
    let key = this.keySelector(this.currentItems[index]);
    let ret = this.viewModelCache.get(key);
    if (ret) return ret;

    ret = this.createViewModel(this.currentItems[index], index);
    ret.addTeardown(() => this.viewModelCache.del(key));
    this.viewModelCache.set(key, ret);

    return ret;
  }

  getRowCount() {
    if (!this.currentItems) return 0;
    return this.currentItems.length;
  }
}