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
    return <MuiThemeProvider>
      <div>
        <AppBar title='Trickline' onLeftIconButtonTouchTap={this.viewModel.toggleDrawer.bind()} />

        <Drawer open={this.viewModel.isOpen}>
          <h2>I'm in the drawer</h2>
        </Drawer>

        <p>I am the main content</p>
      </div>
    </MuiThemeProvider>;
  }
}