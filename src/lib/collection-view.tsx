import * as React from 'react';
import * as pick from 'lodash.pick';
import { AutoSizer, List } from 'react-virtualized';
import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';

import { Model } from './model';
import { Lifecycle, View, HasViewModel } from './view';
import { when, whenArray } from './when';
import * as LRU from 'lru-cache';

export interface CollectionViewProps<T> {
  viewModel: T;
  arrayProperty: string;
  rowHeight?: number;
  width?: number;
  height?: number;
  disableWidth?: boolean;
  disableHeight?: boolean;
}

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

    opts.dispose = (_k: string, v: Model) => { v.unsubscribe(); }
    this.viewModelCache = LRU<Model>(opts);

    let initialVm = props.viewModel;
    lifecycle.didMount.map(() => ({ viewModel: initialVm })).concat(lifecycle.willReceiveProps)
      .do(() => console.log("Got a VM!"))
      .switchMap(p => whenArray(p.viewModel, itemsSelector))
      .do(() => console.log("Got an Array Change!"))
      .takeUntil(lifecycle.willUnmount)
      .subscribe(v => {
        this.currentItems = v.value;
        this.shouldRender.next();
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

export abstract class CollectionView<T extends Model, TChild extends Model>
    extends View<T, CollectionViewProps<T>> {
  private viewModelCache: { [key: number]: TChild } = {};
  private listRef: List;

  readonly lifecycle: Lifecycle<CollectionViewProps<T>, null>;

  abstract viewModelFactory(item: any, index: number): TChild;
  abstract renderItem(viewModel: TChild): JSX.Element;

  static defaultProps = {
    rowHeight: 32,
    width: 300,
    disableWidth: true
  };

  constructor(props?: CollectionViewProps<T>, context?: any) {
    super(props, context);

    const updater = () => {
      if (!this.viewModel) return;
      this.forceUpdate();

      if (!this.listRef) return;
      this.listRef.forceUpdateGrid();
    };

    this.lifecycle.willReceiveProps
      .startWith(props)
      .switchMap(x => x ? when(x.viewModel, x.arrayProperty) : Observable.never())
      .takeUntil(this.lifecycle.willUnmount)
      .subscribe(() => {
        this.clearViewModelCache();
        this.queueUpdate(updater);
      }, (e) => setTimeout(() => { throw e; }, 10));

    this.lifecycle.willUnmount.subscribe(() => {
      this.clearViewModelCache();
    });
  }

  clearViewModelCache() {
    // TODO: It would be rull cool if we could reuse these in some sane way
    Object.keys(this.viewModelCache).forEach(x => this.viewModelCache[x].unsubscribe());
    this.viewModelCache = {};
  }

  getOrCreateViewModel(index: number): TChild {
    if (!this.viewModelCache[index]) {
      const arr: Array<any> = this.props.viewModel[this.props.arrayProperty];
      const itemViewModel = this.viewModelFactory(arr[index], index);

      itemViewModel.addTeardown(() => delete this.viewModelCache[index]);
      this.viewModelCache[index] = itemViewModel;
    }

    return this.viewModelCache[index];
  }

  rowRenderer({ index, style }: { index: number, style: React.CSSProperties }) {
    return (
      <div key={index} style={style}>
        {this.renderItem(this.getOrCreateViewModel(index))}
      </div>
    );
  }

  rowCount() {
    const arr: Array<any> = this.props.viewModel[this.props.arrayProperty];
    return arr.length;
  }

  render() {
    const autoSizerProps = pick(this.props, ['disableWidth', 'disableHeight']);
    const listProps = pick(this.props, ['width', 'height', 'rowHeight']);

    if (listProps.width && listProps.height) {
      return (
        <List
          {...listProps}
          rowRenderer={this.rowRenderer.bind(this)}
          rowCount={this.rowCount()}
        />
      );
    }

    let refBind = ((l: List) => this.listRef = l).bind(this);
    return (
      <AutoSizer {...autoSizerProps}>
        {({ width, height }: { width: number, height: number }) => (
          <List
            ref={refBind}
            width={width}
            height={height}
            {...listProps}
            rowRenderer={this.rowRenderer.bind(this)}
            rowCount={this.rowCount()}
          />
        )}
      </AutoSizer>
    );
  }
}