import * as React from 'react';
import * as pick from 'lodash.pick';
import { AutoSizer, List } from 'react-virtualized';
import { ArrayObserver } from 'observe-js';

import { Model } from './model';
import { AttachedLifecycle, Lifecycle } from './view';
import { SerialSubscription } from './serial-subscription';

export interface CollectionViewProps<T> {
  listItems: T[];
  rowHeight?: number;
  width?: number;
  height?: number;
  disableWidth?: boolean;
  disableHeight?: boolean;
}

export abstract class CollectionView<T, TChild extends Model>
    extends React.Component<CollectionViewProps<T>, null>
    implements AttachedLifecycle<CollectionViewProps<T>, null> {

  private viewModelCache: { [key: number]: TChild } = {};
  private readonly arraySub: SerialSubscription;

  readonly lifecycle: Lifecycle<CollectionViewProps<T>, null>;

  abstract viewModelFactory(item: T, index: number): TChild;
  abstract renderItem(viewModel: TChild): JSX.Element;

  static defaultProps = {
    rowHeight: 32,
    width: 300,
    disableWidth: true
  };

  constructor(props?: CollectionViewProps<T>, context?: any) {
    super(props, context);
    this.lifecycle = Lifecycle.attach(this);
    this.arraySub = new SerialSubscription();

    this.lifecycle.willReceiveProps.subscribe(p => {
      const observer = new ArrayObserver(p.listItems);

      observer.open((splices) => {
        splices.forEach(splice => {
          // Invalidate items in our ViewModel cache that match
          let len = Math.max(splice.addedCount, splice.removed ? splice.removed.length : 0);
          for (let i = 0; i < len; i++) {
            let idx = splice.index + i;
            let item = this.viewModelCache[idx];
            if (!item) continue;

            item.unsubscribe();
            delete this.viewModelCache[idx];
          }
        });

        this.forceUpdate();
      });

      this.arraySub.set(() => observer.close());
    });

    this.lifecycle.willUnmount.subscribe(() => {
      this.viewModelCache = {};
      this.arraySub.unsubscribe();
    });
  }

  getOrCreateViewModel(index: number): TChild {
    if (!this.viewModelCache[index]) {
      const itemViewModel = this.viewModelFactory(this.props.listItems[index], index);
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
    return this.props.listItems.length;
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

    return (
      <AutoSizer {...autoSizerProps}>
        {({ width, height }: { width: number, height: number }) => (
          <List
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