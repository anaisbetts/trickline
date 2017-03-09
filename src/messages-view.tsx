// tslint:disable-next-line:no-unused-variable
import * as React from 'react';
import { AutoSizer, CellMeasurer, CellMeasurerCache, InfiniteLoader, List } from 'react-virtualized';

import { Api, isChannel } from './lib/models/slack-api';
import { ChannelBase, Message } from './lib/models/api-shapes';
import { CollectionView } from './lib/collection-view';
import { fromObservable, Model } from './lib/model';
import { MessageViewModel, MessageListItem } from './message-list-item';
import { Store } from './lib/store';
import { Subject } from 'rxjs/Subject';
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

export class MessagesViewModel extends Model {
  readonly api: Api;
  readonly fetchMore: Subject<string>;
  @fromObservable messages: Array<Message>;
  @fromObservable messagesCount: number;

  constructor(public readonly store: Store, public readonly channel: ChannelBase) {
    super();
    this.api = this.channel.api;
    this.fetchMore = new Subject<string>();

    when(this, x => x.channel)
      .filter(channel => isChannel(channel))
      .switchMap(() => {
        return this.fetchMore.flatMap((latest) =>
          this.store.messages.listen({ channel: this.channel.id, latest }, this.api));
      })
      .map(({ messages }) => (this.messages || []).concat(messages))
      .toProperty(this, 'messages');

    when(this, x => x.messages)
      .map(messages => messages ? messages.length : 0)
      .toProperty(this, 'messagesCount');

    this.fetchMore.next(this.channel.latest);
  }

  async fetchMessageHistory(latest: string) {
    this.fetchMore.next(latest);

    await this.changed
      .filter(({ property }) => property === 'messages')
      .toPromise();
  }
}

export class MessagesView extends CollectionView<MessagesViewModel, MessageViewModel> {
  private readonly cache: CellMeasurerCache = new CellMeasurerCache({
    fixedWidth: true,
    minHeight: 43
  });

  rowCount() {
    return this.viewModel.messagesCount;
  }

  viewModelFactory(index: number) {
    const message = this.viewModel.messages[index];
    return new MessageViewModel(this.viewModel.store, this.viewModel.api, message);
  }

  isRowLoaded({ index }: { index: number }) {
    return !!this.viewModel.messages[index];
  }

  async loadMoreRows({ startIndex }: { startIndex: number }) {
    const latest = this.viewModel.messages[startIndex - 1].ts;
    await this.viewModel.fetchMessageHistory(latest);
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

  render() {
    const key = this.viewModel.channel ? this.viewModel.channel.id : null;

    return (
      <div style={{ width: '100%', height: '100%' }}>
        <InfiniteLoader
          isRowLoaded={this.isRowLoaded.bind(this)}
          loadMoreRows={this.loadMoreRows.bind(this)}
          rowCount={this.viewModel.messagesCount * 2}
        >
          {({ onRowsRendered, registerChild }: any) => (
            <AutoSizer disableWidth>
              {({ width, height }: { width: number, height: number }) => (
                <List
                  key={key}
                  width={width}
                  height={height}
                  onRowsRendered={onRowsRendered}
                  registerChild={registerChild}
                  deferredMeasurementCache={this.cache}
                  rowHeight={this.cache.rowHeight}
                  rowCount={this.viewModel.messagesCount}
                  rowRenderer={this.rowRenderer.bind(this)}
                />
              )}
            </AutoSizer>
          )}
        </InfiniteLoader>
      </div>
    );
  }
}