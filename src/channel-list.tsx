// tslint:disable-next-line:no-unused-variable
import * as React from 'react';

import { ChannelBase } from './lib/models/api-shapes';
import { CollectionView } from './lib/collection-view';
import { fromObservable, notify, Model } from './lib/model';
import { Store, ChannelList } from './lib/store';

import { ChannelViewModel, ChannelListItem } from './channel-list-item';
import { channelSort } from './channel-utils';

@notify('selectedChannel')
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

export class ChannelListView extends CollectionView<ChannelListViewModel, ChannelViewModel> {
  viewModelFactory(index: number) {
    const channel = this.viewModel.orderedChannels[index];
    return new ChannelViewModel(this.viewModel, channel);
  }

  renderItem(viewModel: ChannelViewModel) {
    return <ChannelListItem viewModel={viewModel} />;
  }

  rowCount() {
    return this.viewModel.orderedChannels.length;
  }
}