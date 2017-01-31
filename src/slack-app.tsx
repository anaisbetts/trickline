// tslint:disable-next-line:no-unused-variable
import * as React from 'react';

import { default as AppBar } from 'material-ui/AppBar';
import { default as Drawer } from 'material-ui/Drawer';
import { default as MuiThemeProvider } from 'material-ui/styles/MuiThemeProvider';

import { Action } from './action';
import { SimpleView } from './view';
import { asProperty, Model } from './model';

export interface SlackAppState {
  drawerOpen: boolean;
}

export class SimpleViewModel extends Model {
  toggleDrawer: Action<boolean>;

  constructor() {
    super();

    let isOpen = false;
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

    return <MuiThemeProvider>
      <div style={{marginLeft: vm.isOpen ? '258px' : '0px', transition: 'margin-left: 450ms cubic-bezier(0.23, 1, 0.32, 1) 0ms'}}>
        <AppBar title='Trickline' onLeftIconButtonTouchTap={vm.toggleDrawer.bind()} zDepth={2}/>

        <Drawer open={vm.isOpen} zDepth={1}>
          <h2>I'm in the drawer</h2>
        </Drawer>

        <p>I am the main content</p>
      </div>
    </MuiThemeProvider>;
  }
}