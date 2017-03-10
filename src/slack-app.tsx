// tslint:disable-next-line:no-unused-variable
import * as React from 'react';

// tslint:disable-next-line:no-unused-variable
import { Observable } from 'rxjs/Observable';
import { createProxyForRemote } from 'electron-remote';

import Drawer from 'material-ui/Drawer';
import  MuiThemeProvider from 'material-ui/styles/MuiThemeProvider';
import getMuiTheme from 'material-ui/styles/getMuiTheme';

import { Action } from './lib/action';
import { SimpleView } from './lib/view';
import { fromObservable, Model } from './lib/model';
import { BrokenOldStoreThatDoesntWorkRight, Store, NaiveStore, handleRtmMessagesForStore, connectToRtm } from './lib/store';

import { ChannelBase } from './lib/models/api-shapes';
import { ChannelHeaderViewModel, ChannelHeaderView } from './channel-header';
import { ChannelListViewModel, ChannelListView } from './channel-list';
import { MemoryPopover } from './memory-popover';
import { MessagesViewModel, MessagesView } from './messages-view';
import { when } from './lib/when';
//import { takeHeapSnapshot } from './profiler';

import './lib/standard-operators';
import { SerialSubscription } from './lib/serial-subscription';

export const DrawerWidth = 300;

export interface SlackAppState {
  drawerOpen: boolean;
}

const slackTheme = getMuiTheme({
  fontFamily: 'Slack-Lato',

  // Customize our color palette with:
  palette: {
    // textColor: cyan500,
  },

  // Customize individual components like:
  appBar: {
    height: 50,
  }
});

export class SlackAppModel extends Model {
  store: Store;
  channelList: ChannelListViewModel;
  channelHeader: ChannelHeaderViewModel;
  loadInitialState: Action<void>;
  @fromObservable isDrawerOpen: boolean;
  @fromObservable messagesViewModel: MessagesViewModel;

  constructor() {
    super();

    // NB: Solely for debugging purposes
    global.slackApp = this;

    const tokenSource = process.env.SLACK_API_TOKEN || window.localStorage.getItem('token') || '';
    const tokens = tokenSource.indexOf(',') >= 0 ? tokenSource.split(',') : [tokenSource];

    this.store = new NaiveStore(tokens);
    this.channelList = new ChannelListViewModel(this.store);
    this.channelHeader = new ChannelHeaderViewModel(this.store, this.channelList);

    when(this, x => x.channelHeader.isDrawerOpen)
      .toProperty(this, 'isDrawerOpen');

    when(this, x => x.channelList.selectedChannel)
      .filter(channel => !!channel)
      .map(channel => new MessagesViewModel(this.store, channel))
      .toProperty(this, 'messagesViewModel');

    const rtmSub = new SerialSubscription();
    rtmSub.set(handleRtmMessagesForStore(connectToRtm(this.store.api), this.store));

    this.loadInitialState = new Action<void>(() => this.store.fetchInitialChannelList(), undefined);
  }
}

export class SlackApp extends SimpleView<SlackAppModel> {
  constructor() {
    super();
    this.viewModel = new SlackAppModel();
    this.viewModel.loadInitialState.execute();

    if (process.env['TRICKLINE_HEAPSHOT_AND_BAIL']) {
      const mainProcess = createProxyForRemote(null);
      this.takeHeapshot().then(() => mainProcess.tracingControl.stopTracing(true));
    }
  }

  async takeHeapshot() {
    await this.viewModel.channelHeader.toggleDrawer.execute().toPromise();
    await this.viewModel.store.joinedChannels
      .filter((x: any) => x && x.length > 0)
      .take(1)
      .timeout(10 * 1000)
      .catch(() => Observable.of(true))
      .toPromise();

    await Observable.timer(250).toPromise();
    //await takeHeapSnapshot();
  }

  render() {
    const vm = this.viewModel;
    const shouldShift = vm.isDrawerOpen && window.outerWidth > window.outerHeight;
    const containerStyle = {
      height: '100%',
      marginLeft: shouldShift ? `${DrawerWidth}px` : '0px',
      transition: 'margin-left: 450ms cubic-bezier(0.23, 1, 0.32, 1) 0ms'
    };

    const channelListView = vm.isDrawerOpen ? (
      <ChannelListView viewModel={vm.channelList} arrayProperty='orderedChannels' />
    ) : null;

    const messagesView = vm.messagesViewModel ? (
      <MessagesView
        key={vm.messagesViewModel.channel.id}
        viewModel={vm.messagesViewModel}
        arrayProperty='messages'
      />
    ) : null;

    return (
      <MuiThemeProvider muiTheme={slackTheme}>
        <div style={containerStyle}>
          <ChannelHeaderView viewModel={vm.channelHeader} />

          <Drawer open={vm.isDrawerOpen} zDepth={1} width={DrawerWidth}>
            {channelListView}
          </Drawer>

          {messagesView}
          <MemoryPopover />
        </div>
      </MuiThemeProvider>
    );
  }
}