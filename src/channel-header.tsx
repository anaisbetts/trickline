// tslint:disable-next-line:no-unused-variable
import * as React from 'react';
import AppBar from 'material-ui/AppBar';

import { Action } from './lib/action';
import { ChannelBase } from './lib/models/api-shapes';
import { Model, fromObservable } from './lib/model';
import { SimpleView } from './lib/view';
import { Store } from './store';

export class ChannelHeaderViewModel extends Model {
  toggleDrawer: Action<boolean>;
  @fromObservable isDrawerOpen: boolean;
  @fromObservable selectedChannel: ChannelBase;

  constructor(readonly store: Store) {
    super();

    let isDrawerOpen = false;
    this.toggleDrawer = Action.create(() => isDrawerOpen = !isDrawerOpen, false);
    this.toggleDrawer.result.toProperty(this, 'isDrawerOpen');
  }
}

export class ChannelHeaderView extends SimpleView<ChannelHeaderViewModel> {

  render() {
    const channelName = this.viewModel.selectedChannel ?
      this.viewModel.selectedChannel.name :
      'Trickline';

    return (
      <AppBar
        title={channelName}
        zDepth={2}
        onLeftIconButtonTouchTap={this.viewModel.toggleDrawer.bind()}
      />
    );
  }
}