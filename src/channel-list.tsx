// tslint:disable-next-line:no-unused-variable
import * as React from 'react';
import { AutoSizer, List } from 'react-virtualized';

import { ChannelBase } from './lib/models/api-shapes';
import { ChannelViewModel, ChannelListItem } from './channel-list-item';
import { channelSort, isChannel, isDM } from './lib/models/slack-api';
import { ViewModelListHelper } from './lib/collection-view';
import { fromObservable, notify, Model } from './lib/model';
import { Store } from './lib/store';
import { whenArray } from './lib/when';
import { Updatable } from './lib/updatable';
import { SimpleView, HasViewModel, View } from './lib/view';

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
    whenArray(this, x => x.channels)
      .switchMap(async ({value}) => {
        if (!value) return [];
        let updatables = Array.from(store.channels.listenMany(value || []).values());
        await Promise.all(updatables.map(x => x.waitForValue()));

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

export class ChannelListView extends SimpleView<ChannelListViewModel> {
  viewModelCache: ViewModelListHelper<ChannelListViewModel, HasViewModel<ChannelListViewModel>, null>;
  listRef: List;
  noAutoSize: boolean;

  constructor(props: { viewModel: ChannelListViewModel, noAutoSize: boolean }, context?: any) {
    super(props, context);

    this.viewModelCache = new ViewModelListHelper(
      this.lifecycle, props,
      (x: ChannelListViewModel) => x.orderedChannels,
      x => x.value.id,
      x => new ChannelViewModel(this.viewModel!.store, this.viewModel!, x));

    const update = () => {
      this.listRef.forceUpdateGrid();
      this.forceUpdate();
    };

    this.viewModelCache.shouldRender.subscribe(() => this.queueUpdate(update));
    this.noAutoSize = props.noAutoSize;
  }

  rowRenderer({index, key, style}: {index: number, key: any, style: React.CSSProperties}) {
    let vm = this.viewModelCache.getViewModel(index) as ChannelViewModel;
    return (
      <div key={key} style={style}>
        <ChannelListItem key={key} viewModel={vm} />
      </div>
    );
  }

  render() {
    let refBind = ((l: List) => this.listRef = l).bind(this);

    // NB: We do this for the test suite so that autosizer
    // doesn't immediately determine that our size is zero
    if (View.isInTestRunner) {
      return <List
        ref={refBind}
        width={1000}
        height={1000}
        rowHeight={32}
        rowRenderer={this.rowRenderer.bind(this)}
        rowCount={this.viewModelCache.getRowCount()} />;
    }

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