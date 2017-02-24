// tslint:disable-next-line:no-unused-variable
import * as React from 'react';
import { AutoSizer, List } from 'react-virtualized';

import { SimpleView } from './lib/view';
import { fromObservable, Model } from './lib/model';
import { Store } from './lib/store';
import { Updatable } from './lib/sparse-map';

import { ChannelBase } from './lib/models/api-shapes';
import { ChannelViewModel, ChannelListItem } from './channel-list-item';

export class ChannelListViewModel extends Model {
  store: Store;
  selectedChannel: ChannelBase;
  @fromObservable joinedChannels: Array<Updatable<ChannelBase>>;

  constructor(store: Store) {
    super();
    this.store = store;
    store.joinedChannels.toProperty(this, 'joinedChannels');
  }
}

export class ChannelListView extends SimpleView<ChannelListViewModel> {
  rowRenderer(opts: any): JSX.Element {
    const { index, style } = opts;
    const item = this.viewModel.joinedChannels[index];

    return (
      <div
        key={item.value.id}
        style={style}
      >
        <ChannelListItem viewModel={new ChannelViewModel(item)} />
      </div>
    );
  }

  listRenderer(opts: any): JSX.Element {
    let { width, height } = opts;

    return (
      <List
        width={width}
        height={height}
        rowRenderer={this.rowRenderer.bind(this)}
        rowCount={this.viewModel.joinedChannels.length}
        rowHeight={28}
      />
    );
  }

  render() {
    return (
      <AutoSizer>
        {this.listRenderer.bind(this)}
      </AutoSizer>
    );
  }
}