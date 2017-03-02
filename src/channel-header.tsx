// tslint:disable-next-line:no-unused-variable
import * as React from 'react';
import AppBar from 'material-ui/AppBar';
import { Tab } from 'material-ui/Tabs';

import { Action } from './lib/action';
import { Channel, ChannelBase } from './lib/models/api-shapes';
import { ChannelListViewModel } from './channel-list';
import { Model, fromObservable } from './lib/model';
import { SimpleView } from './lib/view';
import { Store } from './store';
import { when } from './lib/when';

export class ChannelHeaderViewModel extends Model {
  @fromObservable selectedChannel: ChannelBase;
  @fromObservable channelInfo: Channel;
  @fromObservable members: Array<string>;
  @fromObservable topic: { value: string};
  @fromObservable isDrawerOpen: boolean;
  toggleDrawer: Action<boolean>;

  constructor(public readonly store: Store, listViewModel: ChannelListViewModel) {
    super();

    let isDrawerOpen = false;
    this.toggleDrawer = Action.create(() => isDrawerOpen = !isDrawerOpen, false);
    this.toggleDrawer.result.toProperty(this, 'isDrawerOpen');

    when(listViewModel, x => x.selectedChannel)
      .toProperty(this, 'selectedChannel');

    when(this, x => x.selectedChannel)
      .filter(c => !!c)
      .switchMap(c => this.store.channels.listen(c.id, c.api))
      .do(x => console.log(`New ChannelInfo! ${JSON.stringify(x)}`))
      .toProperty(this, 'channelInfo');

    // NB: This works but it's too damn clever
    when(this, x => x.channelInfo)
      .filter(x => x && !x.topic)
      .subscribe(x => this.store.channels.listen(x.id, x.api).invalidate())

    when(this, x => x.channelInfo.members)
      .startWith([])
      .toProperty(this, 'members');

    when(this, x => x.channelInfo.topic)
      .startWith({value: ''})
      .toProperty(this, 'topic');
  }
}

export class ChannelHeaderView extends SimpleView<ChannelHeaderViewModel> {
  render() {
    const channelName = this.viewModel.selectedChannel ?
      this.viewModel.selectedChannel.name :
      'Trickline';

    let tabs = [];
    if (this.viewModel.channelInfo) {
      const tabStyle = {
        paddingLeft: '20px',
        paddingRight: '20px'
      };

      tabs.push(
        <Tab
          key='members'
          label={`Members: ${this.viewModel.members.length}`}
          style={tabStyle}
        />
      );

      tabs.push(
        <Tab
          key='topic'
          label={this.viewModel.topic.value}
          style={tabStyle}
        />
      );
    }

    return (
      <AppBar
        title={channelName}
        zDepth={2}
        onLeftIconButtonTouchTap={this.viewModel.toggleDrawer.bind()}
      >
        {tabs}
      </AppBar>
    );
  }
}