// tslint:disable-next-line:no-unused-variable
import * as React from 'react';
import { AutoSizer, List } from 'react-virtualized';

import { SimpleView } from './lib/view';
import { fromObservable, Model } from './lib/model';
import { Store, ChannelList } from './lib/store';
import { channelSort } from './channel-utils';

import { ChannelBase } from './lib/models/api-shapes';
import { ChannelViewModel, ChannelListItem } from './channel-list-item';

export class ChannelListViewModel extends Model {
  store: Store;
  selectedChannel: ChannelBase;
  @fromObservable channels: ChannelList;
  @fromObservable orderedChannels: ChannelList;

  constructor(store: Store) {
    super();
    this.store = store;

    store.channels.toProperty(this, 'channels');

    this.when('channels')
      .map((list: any) => {
        return list.value
          .filter((c: any) => !c.value.is_archived)
          .sort(channelSort);
      })
      .toProperty(this, 'orderedChannels');
  }
}

export class ChannelListView extends SimpleView<ChannelListViewModel> {
  rowRenderer(opts: any): JSX.Element {
    const { index, style } = opts;
    const item = this.viewModel.orderedChannels[index];

    return (
      <div
        key={item.value.id}
        style={style}
      >
        <ChannelListItem viewModel={new ChannelViewModel(this.viewModel.store, item)} />
      </div>
    );
  }

  listRenderer({ height }: { height: number }): JSX.Element {
    return (
      <List
        width={300}
        height={height}
        rowRenderer={this.rowRenderer.bind(this)}
        rowCount={this.viewModel.orderedChannels.length}
        rowHeight={32}
      />
    );
  }

  render() {
    return (
      <AutoSizer disableWidth>
        {this.listRenderer.bind(this)}
      </AutoSizer>
    );
  }
}