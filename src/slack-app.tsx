// tslint:disable-next-line:no-unused-variable
import * as React from 'react';

import { default as AppBar } from 'material-ui/AppBar';
import { default as Drawer } from 'material-ui/Drawer';
import { default as MuiThemeProvider } from 'material-ui/styles/MuiThemeProvider';

import { Observable } from 'rxjs/Observable';
import { ChannelBase, UsersCounts } from './models/api-shapes';
import { createApi } from './models/api-call';

import { Action } from './action';
import { SimpleView } from './view';
import { asProperty, Model } from './model';
import { InMemorySparseMap, Updatable } from './sparse-map';

export interface SlackAppState {
  drawerOpen: boolean;
}

export class Store {
  joinedChannels: SparseMap<string, ChannelBase>;
  api: any;

  constructor(token?: string) {
    this.api = createApi(token);
    this.joinedChannels = new InMemorySparseMap();
  }

  async update(): Promise<void> {
    let result: UsersCounts = await this.api.users.counts().toPromise();

    result.channels.forEach(c => {
      let updater = new Updatable(() => this.api.channels.info({channel: c.id}).map(x => x.channel as ChannelBase));
      updater.playOnto(Observable.of(c));

      this.joinedChannels.setDirect(c.id, updater);
    });

    result.groups.forEach(c => {
      let updater = new Updatable(() => this.api.groups.info({channel: c.id}).map(x => x.group as ChannelBase));
      updater.playOnto(Observable.of(c));

      this.joinedChannels.setDirect(c.id, updater);
    });

    result.ims.forEach(c => {
      let updater = new Updatable(() => this.api.im.info({channel: c.id}).map(x => x.im as ChannelBase));
      updater.playOnto(Observable.of(c));

      this.joinedChannels.setDirect(c.id, updater);
    });
  }
}

export class SimpleViewModel extends Model {
  toggleDrawer: Action<boolean>;
  store: Store;

  constructor() {
    super();

    let isOpen = false;
    this.store = new Store(localStorage.getItem('token'));
    this.toggleDrawer = Action.create(() => isOpen = !isOpen, false);
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
          <h2>I'm in the drawer</h2>
        </Drawer>

        <p>I am the main content</p>
      </div>
    </MuiThemeProvider>;
  }
}