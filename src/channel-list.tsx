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
  private readonly viewModelCache: { [key: number]: ChannelViewModel } = {};

  getOrCreateViewModel(index: number) {
    if (!this.viewModelCache[index]) {
      const channel = this.viewModel.orderedChannels[index];
      const onUnsubscribe = () => {
        delete this.viewModelCache[index];
      };

      this.viewModelCache[index] = new ChannelViewModel({
        store: this.viewModel.store,
        model: channel,
        onUnsubscribe
      });
    }
    return this.viewModelCache[index];
  }

  rowRenderer(opts: any): JSX.Element {
    const { index, style } = opts;
    const itemViewModel = this.getOrCreateViewModel(index);

    return (
      <div
        key={itemViewModel.id}
        style={style}
      >
        <ChannelListItem viewModel={itemViewModel} />
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