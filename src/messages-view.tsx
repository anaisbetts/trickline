// tslint:disable-next-line:no-unused-variable
import * as React from 'react';
import { AutoSizer, List, CellMeasurer, CellMeasurerCache } from 'react-virtualized';

import { Api, isChannel } from './lib/models/slack-api';
import { ChannelBase, Message } from './lib/models/api-shapes';
import { CollectionView } from './lib/collection-view';
import { fromObservable, notify, Model } from './lib/model';
import { MessageViewModel, MessageListItem } from './message-list-item';
import { Store } from './lib/store';
import { when } from './lib/when';

export interface MessageCollection {
  [ts: string]: Message;
};

export interface RowRendererArgs {
  index: number;
  key: number;
  style: React.CSSProperties;
  parent: List;
}

@notify('selectedChannel')
export class MessagesViewModel extends Model {
  readonly api: Api;
  @fromObservable messages: Array<Message>;
  @fromObservable messagesCount: number;

  constructor(public readonly store: Store, public readonly channel: ChannelBase) {
    super();
    this.api = this.channel.api;

    when(this, x => x.channel)
      .filter(channel => channel && isChannel(channel))
      .switchMap(channel => store.messages.listen(channel.id, channel.api))
      .toProperty(this, 'messages');

    when(this, x => x.messages)
      .filter(messages => !!messages)
      .map(messages => messages.length)
      .startWith(0)
      .toProperty(this, 'messagesCount');
  }
}

export class MessagesView extends CollectionView<MessagesViewModel, MessageViewModel> {
  private readonly cache: CellMeasurerCache = new CellMeasurerCache({
    fixedWidth: true,
    minHeight: 60
  });

  rowCount() {
    return this.viewModel.messagesCount;
  }

  viewModelFactory(index: number) {
    const message = this.viewModel.messages[index];
    return new MessageViewModel(this.viewModel.store, this.viewModel.api, message);
  }

  renderItem(viewModel: MessageViewModel) {
    return <MessageListItem viewModel={viewModel} />;
  }

  rowRenderer({ index, key, style, parent }: RowRendererArgs) {
    const viewModel = this.getOrCreateViewModel(index);

    return (
      <CellMeasurer
        cache={this.cache}
        columnIndex={0}
        key={key}
        rowIndex={index}
        parent={parent}
      >
        <div style={style}>
          {this.renderItem(viewModel)}
        </div>
      </CellMeasurer>
    );
  }

  renderList({ width, height }: { width: number, height: number }) {
    const key = this.viewModel.channel ? this.viewModel.channel.id : null;
    return (
      <List
        key={key}
        width={width}
        height={height}
        deferredMeasurementCache={this.cache}
        rowHeight={this.cache.rowHeight}
        rowCount={this.viewModel.messagesCount}
        rowRenderer={this.rowRenderer.bind(this)}
      />
    );
  }

  render() {
    return (
      <div style={{ width: '100%', height: '100%' }}>
        <AutoSizer disableWidth>
          {this.renderList.bind(this)}
        </AutoSizer>
      </div>
    );
  }
}