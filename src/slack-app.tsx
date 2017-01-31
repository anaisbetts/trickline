// tslint:disable-next-line:no-unused-variable
import * as React from 'react';

import { default as AppBar } from 'material-ui/AppBar';
import { default as Drawer } from 'material-ui/Drawer';
import { default as MuiThemeProvider } from 'material-ui/styles/MuiThemeProvider';

import { Action } from './action';
import { View } from './view';

export interface SlackAppState {
  drawerOpen: boolean;
}

export class SlackApp extends View<null> {
  toggleDrawer: Action<boolean>;

  constructor() {
    super();

    let isOpen = false;
    this.toggleDrawer = Action.create(() => isOpen = !isOpen, false);
    this.lifecycle.didMount
      .flatMap(() => this.toggleDrawer.result)
      .subscribe(() => this.forceUpdate());
    //this.toggleDrawer.toState(this, 'drawerOpen');
  }

  render() {
    return <MuiThemeProvider>
      <div>
        <AppBar title='Trickline' onLeftIconButtonTouchTap={this.toggleDrawer.bind()} />

        <Drawer open={this.toggleDrawer.resultSubject.getValue()}>
          <h2>I'm in the drawer</h2>
        </Drawer>

        <p>I am the main content</p>
      </div>
    </MuiThemeProvider>;
  }
}