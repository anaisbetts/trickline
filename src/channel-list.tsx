// tslint:disable-next-line:no-unused-variable
import * as React from 'react';
import { AutoSizer, List } from 'react-virtualized';

import { ChannelBase } from './lib/models/api-shapes';
import { ChannelViewModel, ChannelListItem } from './channel-list-item';
import { channelSort, isDM } from './lib/models/slack-api';
import { CollectionView, ViewModelListHelper } from './lib/collection-view';
import { fromObservable, notify, Model } from './lib/model';
import { Store } from './lib/store';
import { when } from './lib/when';
import { Updatable } from './lib/updatable';
import { SimpleView, HasViewModel } from './lib/view';

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
        let updatables = Array.from(store.channels.listenMany(list || []).values());
        await Promise.all(updatables.map(x => x.get()));

        return updatables;
      })
      .map(list => {
        return list
          .filter(c => !c.value.is_archived || (isDM(c.value) && c.value.is_open))
          .sort(channelSort);
      })
      .toProperty(this, 'orderedChannels');
  }
}

export class ChannelListView extends SimpleView<ChannelListViewModel> {
  viewModelCache: ViewModelListHelper<ChannelListViewModel, HasViewModel<ChannelListViewModel>, null>;
  listRef: List;

  constructor(props: { viewModel: ChannelListViewModel }, context?: any) {
    super(props, context);

    this.lifecycle.didMount.subscribe(() => console.log("WAT"));
    this.viewModelCache = new ViewModelListHelper(
      this.lifecycle, props,
      (x: ChannelListViewModel) => x.orderedChannels,
      x => x.value.id,
      x => new ChannelViewModel(this.viewModel!, x));
  }

  rowRenderer({index, key, style}: {index: number, key: any, style: React.CSSProperties}) {
    let vm = this.viewModelCache.getViewModel(index) as ChannelViewModel;
    return <div key={key} style={style}>
      <ChannelListItem key={key} viewModel={vm} />;
    </div>;
  }

  render() {
    let refBind = ((l: List) => this.listRef = l).bind(this);

    return <AutoSizer disableWidth={true}>
      {({ width, height }: { width: number, height: number }) => (
        <List
          ref={refBind}
          width={width}
          height={height}
          rowHeight={32}
          rowRenderer={this.rowRenderer.bind(this)}
          rowCount={this.viewModelCache.getRowCount()}
        />
      )}
    </AutoSizer>;
  }
}

export class ChannelListViewOld extends CollectionView<ChannelListViewModel, ChannelViewModel> {
  viewModelFactory(_item: any, index: number) {
    const channel = this.viewModel.orderedChannels[index];
    return new ChannelViewModel(this.viewModel, channel);
  }

  renderItem(viewModel: ChannelViewModel) {
    return <ChannelListItem viewModel={viewModel} />;
  }
}