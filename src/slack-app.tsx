// tslint:disable-next-line:no-unused-variable
import * as React from 'react';

// tslint:disable-next-line:no-unused-variable
import { Observable } from 'rxjs/Observable';
import { createProxyForRemote } from 'electron-remote';

import { default as Drawer } from 'material-ui/Drawer';
import { default as MuiThemeProvider } from 'material-ui/styles/MuiThemeProvider';
import getMuiTheme from 'material-ui/styles/getMuiTheme';

import { Action } from './lib/action';
import { SimpleView } from './lib/view';
import { fromObservable, Model, notify } from './lib/model';
import { Store } from './store';

import { ChannelHeaderViewModel, ChannelHeaderView } from './channel-header';
import { ChannelListViewModel, ChannelListView } from './channel-list';
import { MemoryPopover } from './memory-popover';
import { when } from './lib/when';
//import { takeHeapSnapshot } from './profiler';

import './lib/standard-operators';

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

@notify('channelList')
export class SlackAppModel extends Model {
  store: Store;
  channelList: ChannelListViewModel;
  channelHeader: ChannelHeaderViewModel;
  loadInitialState: Action<void>;
  @fromObservable isDrawerOpen: boolean;

  constructor() {
    super();

    // NB: Solely for debugging purposes
    global.slackApp = this;

    const tokenSource = process.env.SLACK_API_TOKEN || window.localStorage.getItem('token') || '';
    const tokens = tokenSource.indexOf(',') >= 0 ? tokenSource.split(',') : [tokenSource];

    this.store = new Store(tokens);
    this.channelList = new ChannelListViewModel(this.store);
    this.channelHeader = new ChannelHeaderViewModel(this.store, this.channelList);

    when(this, x => x.channelHeader.isDrawerOpen).toProperty(this, 'isDrawerOpen');

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
      marginLeft: shouldShift ? `${DrawerWidth}px` : '0px',
      transition: 'margin-left: 450ms cubic-bezier(0.23, 1, 0.32, 1) 0ms'
    };

    const channelListView = vm.isDrawerOpen ? (
      <ChannelListView viewModel={vm.channelList} />
    ) : null;

    return (
      <MuiThemeProvider muiTheme={slackTheme}>
        <div style={containerStyle}>
          <ChannelHeaderView viewModel={vm.channelHeader} />

          <Drawer open={vm.isDrawerOpen} zDepth={1} width={DrawerWidth}>
            {channelListView}
          </Drawer>

          <MemoryPopover />
        </div>
      </MuiThemeProvider>
    );
  }
}