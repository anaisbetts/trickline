// tslint:disable-next-line:no-unused-variable
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import AppBar from 'material-ui/AppBar';
import Popover from 'material-ui/Popover';
import { Tab } from 'material-ui/Tabs';

import { Action } from './lib/action';
import { Channel, ChannelBase } from './lib/models/api-shapes';
import { ChannelListViewModel } from './channel-list';
import { ChannelMembersViewModel, ChannelMembersView } from './channel-members-view';
import { Model, fromObservable } from './lib/model';
import { SimpleView } from './lib/view';
import { Store } from './store';
import { when } from './lib/when';

export class ChannelHeaderViewModel extends Model {
  @fromObservable selectedChannel: ChannelBase;
  @fromObservable channelInfo: Channel;
  @fromObservable channelMembers: ChannelMembersViewModel;
  @fromObservable topic: { value: string };

  toggleDrawer: Action<boolean>;
  toggleMembersList: Action<boolean>;
  @fromObservable isDrawerOpen: boolean;
  @fromObservable isMembersListOpen: boolean;

  constructor(public readonly store: Store, listViewModel: ChannelListViewModel) {
    super();

    let isDrawerOpen = false;
    this.toggleDrawer = Action.create(() => isDrawerOpen = !isDrawerOpen, false);
    this.toggleDrawer.result.toProperty(this, 'isDrawerOpen');

    let isMembersListOpen = false;
    this.toggleMembersList = Action.create(() => isMembersListOpen = !isMembersListOpen, false);
    this.toggleMembersList.result.toProperty(this, 'isMembersListOpen');

    when(listViewModel, x => x.selectedChannel)
      .toProperty(this, 'selectedChannel');

    when(this, x => x.selectedChannel)
      .filter(c => !!c)
      .switchMap(c => this.store.channels.listen(c.id, c.api))
      .toProperty(this, 'channelInfo');

    // NB: This works but it's too damn clever
    this.innerDisp.add(when(this, x => x.channelInfo)
      .filter(x => x && !x.topic)
      .subscribe(x => this.store.channels.listen(x.id, x.api).invalidate()));

    when(this, x => x.channelInfo)
      .map(info => info ? new ChannelMembersViewModel(this.store, this.selectedChannel.api, info.members) : null)
      .toProperty(this, 'channelMembers');

    when(this, x => x.channelInfo.topic)
      .startWith({ value: '' })
      .toProperty(this, 'topic');
  }
}

export class ChannelHeaderView extends SimpleView<ChannelHeaderViewModel> {
  membersTab: HTMLElement;
  readonly refHandlers = {
    membersTab: (ref: HTMLElement) => this.membersTab = ref
  };

  openMembersList() {
    const anchorElement = ReactDOM.findDOMNode(this.membersTab);
    this.setState({ anchorElement });
    this.viewModel.toggleMembersList.execute();
  }

  renderChannelInfo() {
    if (!this.viewModel.channelInfo || !this.viewModel.channelInfo.members) return null;

    const tabStyle = {
      paddingLeft: '20px',
      paddingRight: '20px'
    };

    return [
      <Tab
        key='members'
        ref={this.refHandlers.membersTab}
        label={`Members: ${this.viewModel.channelInfo.members.length}`}
        onTouchTap={this.openMembersList.bind(this)}
        style={tabStyle}
      />,
      <Tab
        key='topic'
        label={this.viewModel.topic.value}
        style={tabStyle}
      />
    ];
  }

  renderMembersList() {
    if (!this.viewModel.channelMembers) return null;
    const { anchorElement }: { anchorElement?: HTMLElement } = (this.state || {});

    return (
      <Popover
        open={this.viewModel.isMembersListOpen}
        anchorEl={anchorElement}
        anchorOrigin={{ horizontal: 'middle', vertical: 'bottom' }}
        targetOrigin={{ horizontal: 'middle', vertical: 'top' }}
        onRequestClose={this.viewModel.toggleMembersList.bind()}
      >
        <ChannelMembersView
          key={this.viewModel.channelInfo.name}
          viewModel={this.viewModel.channelMembers}
          width={300}
          height={300}
        />
      </Popover>
    );
  }

  render() {
    const channelName = this.viewModel.selectedChannel ?
      this.viewModel.selectedChannel.name :
      'Trickline';

    return (
      <AppBar
        title={channelName}
        zDepth={2}
        onLeftIconButtonTouchTap={this.viewModel.toggleDrawer.bind()}
      >
        {this.renderChannelInfo()}
        {this.renderMembersList()}
      </AppBar>
    );
  }
}