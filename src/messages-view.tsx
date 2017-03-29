// tslint:disable-next-line:no-unused-variable
import * as React from 'react';
import { AutoSizer, CellMeasurer, CellMeasurerCache, InfiniteLoader, List } from 'react-virtualized';

import { Api, timestampToPage, dateToTimestamp } from './lib/models/slack-api';
import { ChannelBase, Message } from './lib/models/api-shapes';
import { ViewModelListHelper } from './lib/collection-view';
import { Model, notify } from './lib/model';
import { MessageViewModel, MessageListItem } from './message-list-item';
import { Store, MessageKey, messageCompare } from './lib/store';
import { getNextPageNumber } from './lib/store-network';
import { SortedArray } from './lib/sorted-array';
import { Action } from './lib/action';
import { Observable } from 'rxjs/Observable';
import { SimpleView, HasViewModel } from './lib/view';

const d = require('debug')('trickline-test:messages-view');

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

  readonly scrollPreviousPage: Action<number>;
  readonly scrollNextPage: Action<number>;

  constructor(public readonly store: Store, public readonly channel: ChannelBase) {
    super();

    this.messagePage = timestampToPage(dateToTimestamp(new Date()));
    this.messages = new SortedArray<MessageKey>({ unique: true, compare: messageCompare });
    this.api = channel.api;

    let messagesForUs = store.events.listen('message', this.api)!
      .filter(x => x && x.channel === channel.id);

    this.addTeardown(messagesForUs.subscribe(x => {
      this.messages.insertOne({ channel: channel.id, timestamp: x.ts});
      Platform.performMicrotaskCheckpoint();
    }));

    this.scrollPreviousPage = new Action(async () => {
      let page = this.messages && this.messages.length > 0 ?
        timestampToPage(this.messages[0].timestamp) :
        this.messagePage;

      let newPage = await getNextPageNumber(store, channel.id, page, false, this.api);

      d(`getNextPageNumber: ${newPage}`);
      return newPage;
    }, this.messagePage);

    this.scrollNextPage = new Action(() => {
      let page = this.messages && this.messages.length > 0 ?
        timestampToPage(this.messages[this.messages.length - 1].timestamp) :
        this.messagePage;

      return getNextPageNumber(store, channel.id, page, true, this.api);
    }, this.messagePage);

    Observable.merge(
      this.scrollPreviousPage.result,
      this.scrollNextPage.result,
      messagesForUs.map(x => timestampToPage(x.ts))
    ).distinctUntilChanged()
      .do(x => d(`Getting messages for page! ${x}`))
      .switchMap(page => store.messagePages.get({ channel: channel.id, page }, this.api))
      .subscribe((x: SortedArray<MessageKey>) => {
        d(`Got new messages! ${x.length}`);
        this.messages.insert(...x);
        Platform.performMicrotaskCheckpoint();
      });
  }
}

export class MessagesView extends SimpleView<MessagesViewModel> {
  viewModelCache: ViewModelListHelper<MessagesViewModel, HasViewModel<MessagesViewModel>, null>;
  listRef: List;

  private readonly cache: CellMeasurerCache = new CellMeasurerCache({
    fixedWidth: true,
    minHeight: 43
  });

  constructor(props: { viewModel: MessagesViewModel }, context?: any) {
    super(props, context);

    this.viewModelCache = new ViewModelListHelper(
      this.lifecycle, props,
      (x: MessagesViewModel) => x.messages,
      x => x.ts,
      (message: MessageKey) => new MessageViewModel(
        this.viewModel!.store,
        this.viewModel!.api,
        this.viewModel!.store.messages.listen(message, this.viewModel!.api)!));

    const update = () => {
      this.listRef.forceUpdateGrid();
      this.forceUpdate();
    };

    this.viewModelCache.shouldRender.subscribe(() => this.queueUpdate(update));
  }

  isRowLoaded({ index }: { index: number }) {
    return !!this.viewModel!.messages[index];
  }

  async loadMoreRows() {
    d('Loading more rows!');
    await this.viewModel!.scrollPreviousPage.execute().toPromise();
  }

  renderItem(viewModel: MessageViewModel) {
    return <MessageListItem viewModel={viewModel} />;
  }

  rowRenderer({ index, key, style, parent }: RowRendererArgs) {
    const viewModel = this.viewModelCache.getViewModel(index) as MessageViewModel;

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
    const key = this.viewModel!.channel ? this.viewModel!.channel.id : null;
    const refBind = (l: List) => this.listRef = l;

    return (
      <div style={{ width: '100%', height: '100%' }}>
        <InfiniteLoader
          isRowLoaded={this.isRowLoaded.bind(this)}
          loadMoreRows={this.loadMoreRows.bind(this)}
          rowCount={Math.min(50, this.viewModel!.messages.length * 2)}
        >
          {({ onRowsRendered, registerChild }: any) => (
            <AutoSizer disableWidth>
              {({ width, height }: { width: number, height: number }) => (
                <List
                  ref={refBind}
                  key={key}
                  width={width}
                  height={height}
                  onRowsRendered={onRowsRendered}
                  registerChild={registerChild}
                  deferredMeasurementCache={this.cache}
                  rowHeight={this.cache.rowHeight}
                  rowCount={this.viewModelCache.getRowCount()}
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