// tslint:disable-next-line:no-unused-variable
import * as React from 'react';
import { AutoSizer, CellMeasurer, CellMeasurerCache, InfiniteLoader, List } from 'react-virtualized';

import { Api, isChannel, timestampToPage, dateToTimestamp, tsToTimestamp } from './lib/models/slack-api';
import { ChannelBase, Message } from './lib/models/api-shapes';
import { CollectionView } from './lib/collection-view';
import { fromObservable, Model, notify } from './lib/model';
import { MessageViewModel, MessageListItem } from './message-list-item';
import { Store, MessageKey } from './lib/store';
import { when, whenArray } from './lib/when';
import { fetchMessagePageForChannel, getNextPageNumber } from './lib/store-network';
import { SortedArray } from './lib/sorted-array';
import { Action } from './lib/action';
import { Observable } from "rxjs/Observable";

export interface MessageCollection {
  [ts: string]: Message;
};

export interface RowRendererArgs {
  index: number;
  key: number;
  style: React.CSSProperties;
  parent: List;
}

@notify('messagePage')
export class MessagesViewModel extends Model {
  readonly api: Api;
  readonly messages: SortedArray<MessageKey>;

  messagePage: number;
  @fromObservable messagesCount: number;

  readonly scrollPreviousPage: Action<number>;
  readonly scrollNextPage: Action<number>;

  constructor(public readonly store: Store, public readonly channel: ChannelBase) {
    super();

    this.messagePage = timestampToPage(dateToTimestamp(new Date()));

    let messagesForUs = store.events.listen('message', channel.api)!
      .filter(x => x.channel === channel.id);

    messagesForUs.subscribe(x => {
      this.messages.insertOne({ channel: channel.id, timestamp: x.ts});
      Platform.performMicrotaskCheckpoint();
    });

    whenArray(this, x => x.messages)
      .map(() => this.messages.length)
      .toProperty(this, 'messagesCount');

    this.scrollPreviousPage = new Action(() => {
      let page = this.messages && this.messages.length > 0 ? this.messages[0].timestamp : this.messagePage;
      return getNextPageNumber(store, channel.id, timestampToPage(page), false, channel.api);
    }, this.messagePage);

    this.scrollNextPage = new Action(() => {
      let page = this.messages && this.messages.length > 0 ? this.messages[this.messages.length - 1].timestamp : this.messagePage;
      return getNextPageNumber(store, channel.id, timestampToPage(page), true, channel.api);
    }, this.messagePage);

    Observable.merge(
      this.scrollPreviousPage.result,
      this.scrollNextPage.result,
      messagesForUs.map(x => timestampToPage(x.ts))
    ).distinctUntilChanged()
      .switchMap(page => store.messagePages.get({ channel: channel.id, page }))
      .subscribe((x: SortedArray<MessageKey>) => {
        this.messages.insert(...x);
        Platform.performMicrotaskCheckpoint();
      });
  }
}

export class MessagesView extends CollectionView<MessagesViewModel, MessageViewModel> {
  private readonly cache: CellMeasurerCache = new CellMeasurerCache({
    fixedWidth: true,
    minHeight: 43
  });

  viewModelFactory(_item: any, index: number) {
    const message = this.viewModel.messages[index];
    return new MessageViewModel(this.viewModel.store, this.viewModel.api, this.viewModel.store.messages.listen(message)!);
  }

  isRowLoaded({ index }: { index: number }) {
    return !!this.viewModel.messages[index];
  }

  async loadMoreRows() {
    await this.viewModel.scrollPreviousPage.execute().toPromise();
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