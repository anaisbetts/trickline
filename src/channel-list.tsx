// tslint:disable-next-line:no-unused-variable
import * as React from 'react';

import { ChannelBase } from './lib/models/api-shapes';
import { ChannelViewModel, ChannelListItem } from './channel-list-item';
import { channelSort, isChannel, isDM } from './lib/models/slack-api';
import { CollectionView } from './lib/collection-view';
import { fromObservable, notify, Model } from './lib/model';
import { Store } from './lib/store';
import { when } from './lib/when';
import { Updatable } from './lib/updatable';

export interface IChannelList {
  selectedChannel?: ChannelBase;
  setSelectedChannel: (channel: ChannelBase) => void;
}

@notify('selectedChannel')
export class ChannelListViewModel extends Model implements IChannelList {
  selectedChannel: ChannelBase;
  @fromObservable channels: string[];
  @fromObservable orderedChannels: Updatable<ChannelBase>[];

  constructor(public store: Store) {
    super();

    store.joinedChannels.toProperty(this, 'channels');
    when(this, x => x.channels)
      .flatMap(async list => {
        let updatables = Array.from(store.channels.listenMany(list || []).values());
        await Promise.all(updatables.map(x => x.get()));

        return updatables;
      })
      .map(list => {
        return list
          .filter(c => {
            if (isChannel(c.value)) {
              return !c.value.is_archived;
            } else if (isDM(c.value)) {
              return c.value.is_open;
            }
          })
          .sort(channelSort);
      })
      .toProperty(this, 'orderedChannels');
  }

  setSelectedChannel(channel: ChannelBase) {
    this.selectedChannel = channel;
  }
}

export class ChannelListView extends CollectionView<ChannelListViewModel, ChannelViewModel> {
  viewModelFactory(_item: any, index: number) {
    const channel = this.viewModel.orderedChannels[index];
    return new ChannelViewModel(this.viewModel.store, this.viewModel, channel);
  }

  renderItem(viewModel: ChannelViewModel) {
    return <ChannelListItem viewModel={viewModel} />;
  }
}