// tslint:disable-next-line:no-unused-variable
import * as React from 'react';
import { AutoSizer, List } from 'react-virtualized';

import { SimpleView } from './lib/view';
import { fromObservable, Model } from './lib/model';
import { Store, ChannelList, GroupList, DirectMessageList } from './lib/store';

import { ChannelBase } from './lib/models/api-shapes';
import { ChannelViewModel, ChannelListItem } from './channel-list-item';

export class ChannelListViewModel extends Model {
  store: Store;
  selectedChannel: ChannelBase;
  @fromObservable channels: ChannelList;
  @fromObservable groups: GroupList;
  @fromObservable ims: DirectMessageList;

  constructor(store: Store) {
    super();
    this.store = store;
    store.channels.toProperty(this, 'channels');
    store.groups.toProperty(this, 'groups');
    store.ims.toProperty(this, 'ims');
  }
}

export class ChannelListView extends SimpleView<ChannelListViewModel> {
  rowRenderer(opts: any): JSX.Element {
    const { index, style } = opts;
    const item = this.viewModel.channels[index];

    return (
      <div
        key={item.value.id}
        style={style}
      >
        <ChannelListItem viewModel={new ChannelViewModel(item)} />
      </div>
    );
  }

  listRenderer({ height }: { height: number }): JSX.Element {
    return (
      <List
        width={300}
        height={height}
        rowRenderer={this.rowRenderer.bind(this)}
        rowCount={this.viewModel.channels.length}
        rowHeight={48}
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