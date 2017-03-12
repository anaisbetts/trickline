// tslint:disable-next-line:no-unused-variable
import * as React from 'react';

import { ChannelBase } from './lib/models/api-shapes';
import { ChannelViewModel, ChannelListItem } from './channel-list-item';
import { channelSort, isDM } from './lib/models/slack-api';
import { CollectionView } from './lib/collection-view';
import { fromObservable, notify, Model } from './lib/model';
import { Store, ChannelList } from './lib/store';
import { when, whenArray } from './lib/when';

import './lib/standard-operators';

@notify('selectedChannel')
export class ChannelListViewModel extends Model {
  selectedChannel: ChannelBase;
  @fromObservable orderedChannels: ChannelList;

  constructor(public store: Store) {
    super();

    whenArray(store, x => x.joinedChannels)
      .map(({value}) => {
        if (!value) return [];
        let updatableChannels = store.channels.listenMany(value);

        return Array.from(updatableChannels.values())
          .filter(c => !c.value.is_archived || (isDM(c.value) && c.value.is_open))
          .sort(channelSort);
      })
      .startWith([])
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