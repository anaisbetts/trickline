import * as pick from 'lodash.pick';
import * as React from 'react';
import { AutoSizer, List } from 'react-virtualized';

import { Model } from './model';
import { View, HasViewModel } from './view';

export interface CollectionViewProps<T extends Model> extends HasViewModel<T> {
  viewModel: T;
  rowHeight: number;
  width?: number;
  height?: number;
  disableWidth?: boolean;
  disableHeight?: boolean;
}

export abstract class CollectionView<
  T extends Model,
  TChild extends Model
> extends View<T, CollectionViewProps<T>> {

  private readonly viewModelCache: { [key: number]: TChild } = {};

  abstract viewModelFactory(index: number): TChild;
  abstract renderItem(viewModel: TChild): JSX.Element;
  abstract rowCount(): number;

  getOrCreateViewModel(index: number): TChild {
    if (!this.viewModelCache[index]) {
      const itemViewModel = this.viewModelFactory(index);
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

  render() {
    const autoSizerProps = pick(this.props, ['disableWidth', 'disableHeight']);
    const listProps = pick(this.props, ['width', 'height', 'rowHeight']);

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