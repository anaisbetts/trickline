// tslint:disable-next-line:no-unused-variable
import * as React from 'react';

// tslint:disable-next-line:no-unused-variable
import { Observable } from 'rxjs/Observable';

import { default as AppBar } from 'material-ui/AppBar';
import { default as Drawer } from 'material-ui/Drawer';
import { default as MuiThemeProvider } from 'material-ui/styles/MuiThemeProvider';

import { Action } from './action';
import { SimpleView } from './view';
import { asProperty, Model } from './model';
import { Store } from './store';

import {ChannelListViewModel, ChannelListView} from './channel-list';

export interface SlackAppState {
  drawerOpen: boolean;
}

export class SimpleViewModel extends Model {
  toggleDrawer: Action<boolean>;
  store: Store;
  channelList: ChannelListViewModel;

  constructor() {
    super();

    // NB: Solely for debugging purposes
    global.slackApp = this;

    let isOpen = false;

    this.store = new Store(localStorage.getItem('token'));
    this.toggleDrawer = Action.create(() => isOpen = !isOpen, false);
    this.channelList = new ChannelListViewModel(this.store);
  }

  @asProperty
  isOpen() { return this.toggleDrawer.result; }
}

export class SlackApp extends SimpleView<SimpleViewModel> {
  constructor() {
    super();
    this.viewModel = new SimpleViewModel();
  }

  render() {
    const vm = this.viewModel;
    const shouldShift = vm.isOpen && window.outerWidth > window.outerHeight;

    return <MuiThemeProvider>
      <div style={{marginLeft: shouldShift ? '258px' : '0px', transition: 'margin-left: 450ms cubic-bezier(0.23, 1, 0.32, 1) 0ms'}}>
        <AppBar title='Trickline' onLeftIconButtonTouchTap={vm.toggleDrawer.bind()} zDepth={2}/>

        <Drawer open={vm.isOpen} zDepth={1}>
          <ChannelListView viewModel={vm.channelList} />
        </Drawer>

        <p>I am the main content</p>
      </div>
    </MuiThemeProvider>;
  }
}