//import * as path from 'path';
//import * as fs from 'fs';

// tslint:disable-next-line:no-unused-variable
import * as React from 'react';

// tslint:disable-next-line:no-unused-variable
import { Observable } from 'rxjs/Observable';

import { default as AppBar } from 'material-ui/AppBar';
import { default as Drawer } from 'material-ui/Drawer';
import { default as MuiThemeProvider } from 'material-ui/styles/MuiThemeProvider';
import getMuiTheme from 'material-ui/styles/getMuiTheme';

import { Action } from './lib/action';
import { SimpleView } from './lib/view';
import { fromObservable, Model } from './lib/model';
import { Store } from './lib/store';

import { ChannelListViewModel, ChannelListView } from './channel-list';
import { MemoryPopover } from './memory-popover';
//import { takeHeapSnapshot } from './profiler';

import { createProxyForRemote } from 'electron-remote';

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

export class SlackAppModel extends Model {
  toggleDrawer: Action<boolean>;
  store: Store;
  channelList: ChannelListViewModel;
  loadInitialState: Action<void>;
  @fromObservable isOpen: boolean;

  constructor() {
    super();

    // NB: Solely for debugging purposes
    global.slackApp = this;

    let isOpen = false;

    this.store = new Store(process.env.SLACK_API_TOKEN || window.localStorage.getItem('token'));
    this.toggleDrawer = Action.create(() => isOpen = !isOpen, false);
    this.channelList = new ChannelListViewModel(this.store);

    this.loadInitialState = new Action<void>(() => this.store.fetchInitialChannelList(), undefined);
    this.toggleDrawer.result.toProperty(this, 'isOpen');
  }
}

export class SlackApp extends SimpleView<SlackAppModel> {
  constructor() {
    super();
    this.viewModel = new SlackAppModel();
    this.viewModel.loadInitialState.execute();

    if (process.env['TRICKLINE_HEAPSHOT_AND_BAIL']) {
      let mainProcess = createProxyForRemote(null);
      this.takeHeapshot().then(() => mainProcess.tracingControl.stopTracing(true));
    }
  }

  async takeHeapshot() {
    await this.viewModel.toggleDrawer.execute().toPromise();
    await this.viewModel.store.channels.filter(x => x && x.length > 0).take(1).toPromise();
    await Observable.timer(250).toPromise();
    //await takeHeapSnapshot();
  }

  render() {
    const vm = this.viewModel;
    const shouldShift = vm.isOpen && window.outerWidth > window.outerHeight;
    const containerStyle = {
      marginLeft: shouldShift ? `${DrawerWidth}px` : '0px',
      transition: 'margin-left: 450ms cubic-bezier(0.23, 1, 0.32, 1) 0ms'
    };

    const channelListView = vm.isOpen ?
      <ChannelListView viewModel={new ChannelListViewModel(vm.store)} /> :
      null;

    return (
      <MuiThemeProvider muiTheme={slackTheme}>
        <div style={containerStyle}>
          <AppBar title='Trickline' onLeftIconButtonTouchTap={vm.toggleDrawer.bind()} zDepth={2}/>

          <Drawer open={vm.isOpen} zDepth={1} width={DrawerWidth}>
            {channelListView}
          </Drawer>

          <MemoryPopover />
        </div>
      </MuiThemeProvider>
    );
  }
}