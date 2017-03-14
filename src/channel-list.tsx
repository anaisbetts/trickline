// tslint:disable-next-line:no-unused-variable
import * as React from 'react';

import { ChannelBase } from './lib/models/api-shapes';
import { ChannelViewModel, ChannelListItem } from './channel-list-item';
import { channelSort, isDM } from './lib/models/slack-api';
import { CollectionView } from './lib/collection-view';
import { fromObservable, notify, Model } from './lib/model';
import { Store } from './lib/store';
import { when } from './lib/when';
import { Updatable } from './lib/updatable';

@notify('selectedChannel')
export class ChannelListViewModel extends Model {
  selectedChannel: ChannelBase;
  @fromObservable channels: string[];
  @fromObservable orderedChannels: Updatable<ChannelBase>[];

  constructor(public store: Store) {
    super();

    store.joinedChannels.toProperty(this, 'channels');
    when(this, x => x.channels)
      .flatMap(async list => {
        let updatables = await store.channels.getMany(list || []);
        return Array.from(updatables.values());
      })
      .map(list => {
        return list
          .filter(c => !c.value.is_archived || (isDM(c.value) && c.value.is_open))
          .sort(channelSort);
      })
      .toProperty(this, 'orderedChannels');
  }
}

export class ChannelListView extends CollectionView<ChannelListViewModel, ChannelViewModel> {
  viewModelFactory(_item: any, index: number) {
    const channel = this.viewModel.orderedChannels[index];
    return new ChannelViewModel(this.viewModel, channel);
  }

  renderItem(viewModel: ChannelViewModel) {
    return <ChannelListItem viewModel={viewModel} />;
  }
}