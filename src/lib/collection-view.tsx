import * as React from 'react';
import * as pick from 'lodash.pick';
import { AutoSizer, List } from 'react-virtualized';
import { ArrayObserver } from 'observe-js';

import { Model } from './model';
import { Lifecycle, View } from './view';
import { SerialSubscription } from './serial-subscription';
import { when } from "./when";

export interface CollectionViewProps<T> {
  viewModel: T;
  arrayProperty: string;
  rowHeight?: number;
  width?: number;
  height?: number;
  disableWidth?: boolean;
  disableHeight?: boolean;
}

export abstract class CollectionView<T extends Model, TChild extends Model>
    extends View<T, CollectionViewProps<T>> {
  private viewModelCache: { [key: number]: TChild } = {};
  private readonly arraySub: SerialSubscription;
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
    this.arraySub = new SerialSubscription();

    this.lifecycle.willReceiveProps
      .startWith(props)
      .do(() => console.log("RECEIVING PROPS"))
      .switchMap(x => when(x.viewModel, x.arrayProperty))
      .do(() => console.log("GOT AN ARRAY COOL"))
      .takeUntil(this.lifecycle.willUnmount)
      .subscribe((p: Array<any>) => {
        if (!p) {
          this.arraySub.set(() => {});
          return;
        }

        const observer = new ArrayObserver(p);

        console.log("OPENING AN OBSERVER");
        if (this.listRef) this.listRef.forceUpdateGrid();
        observer.open((splices) => {
          console.log("NOTIFY OF CHANGE");
          /*
          splices.forEach(splice => {
            // Invalidate items in our ViewModel cache that match
            let len = Math.max(splice.addedCount, splice.removed ? splice.removed.length : 0);
            for (let i = 0; i < len; i++) {
              let idx = splice.index + i;
              let item = this.viewModelCache[idx];
              if (!item) continue;

              console.log("THRASHING VIEWMODEL");
              item.unsubscribe();
              delete this.viewModelCache[idx];
            }
          });
          */
          Object.keys(this.viewModelCache).forEach(x => this.viewModelCache[x].unsubscribe());
          this.viewModelCache = {};

          console.log("FORCING UPDATE");
          if (this.listRef) this.listRef.forceUpdateGrid();
        });

        this.arraySub.set(() => observer.close());
      }, (e) => setTimeout(() => { throw e; }, 10));

    this.lifecycle.willUnmount.subscribe(() => {
      this.viewModelCache = {};
      this.arraySub.unsubscribe();
    });
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