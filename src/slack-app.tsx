import * as React from 'react';

import { default as AppBar } from 'material-ui/AppBar';
import { default as Drawer } from 'material-ui/Drawer';
import { default as MuiThemeProvider } from 'material-ui/styles/MuiThemeProvider';
import { Action } from './action';
import { AttachedLifecycle, Lifecycle } from './view';

export interface SlackAppState {
  drawerOpen: boolean;
}

export class SlackApp extends React.Component<null, SlackAppState> implements AttachedLifecycle<null, SlackAppState> {
  toggleDrawer: Action<boolean>;
  lifecycle: Lifecycle<null, SlackAppState>;

  constructor() {
    super();
    this.lifecycle = Lifecycle.attach(this);

    let isOpen = false;
    this.toggleDrawer = Action.create(() => isOpen = !isOpen, false);
    this.toggleDrawer.toState(this, 'drawerOpen');
  }

  render() {
    return <MuiThemeProvider>
      <div>
        <AppBar title='Trickline' onLeftIconButtonTouchTap={this.toggleDrawer.bind()} />

        <Drawer open={this.state.drawerOpen}>
          <h2>I'm in the drawer</h2>
        </Drawer>

        <p>I am the main content</p>
      </div>
    </MuiThemeProvider>;
  }
}