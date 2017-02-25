// tslint:disable-next-line:no-unused-variable
import * as React from 'react';
import Avatar from 'material-ui/Avatar';
import { ListItem } from 'material-ui/List';
import Star from 'material-ui/svg-icons/toggle/star';
import { pinkA200 } from 'material-ui/styles/colors';

import { SimpleView } from './lib/view';
import { fromObservable, notify, Model } from './lib/model';
import { Updatable } from './lib/sparse-map';

import { ChannelBase } from './lib/models/api-shapes';

@notify('isSelected')
export class ChannelViewModel extends Model {
  isSelected: boolean;

  @fromObservable model: ChannelBase;
  @fromObservable displayName: string;
  @fromObservable mentions: number;
  @fromObservable highlighted: boolean;
  @fromObservable starred: boolean;

  constructor(model: Updatable<ChannelBase>) {
    super();

    model.toProperty(this, 'model');

    this.when('model.name')
      .map((n: any) => this.getDisplayName(n.value))
      .toProperty(this, 'displayName');

    this.when('model.is_starred')
      .map((starred: any) => starred.value)
      .toProperty(this, 'starred');

    this.when('model.mention_count')
      .map((c: any) => c.value)
      .toProperty(this, 'mentions');

    this.when('mentions', 'model.unread_count_display',
      (mentions, unreadCount) =>  mentions.value > 0 || ((unreadCount.value || 0) > 0))
      .toProperty(this, 'highlighted');
  }

  private getDisplayName(name: string) {
    return name.length < 25 ? name : `${name.substr(0, 25)}...`;
  }
}

export class ChannelListItem extends SimpleView<ChannelViewModel> {
  render() {
    const viewModel = this.props.viewModel;
    const fontWeight = viewModel.highlighted ? 'bold' : 'normal';
    const starIcon = viewModel.starred ?
      <Star style={{ top: '0px' }} /> :
      null;

    const badge = viewModel.mentions > 0 ? (
      <Avatar backgroundColor={pinkA200} size={24} style={{ top: '11px' }}>
        {viewModel.mentions}
      </Avatar>
    ) : null;

    return (
      <ListItem
        primaryText={viewModel.displayName}
        leftIcon={starIcon}
        rightAvatar={badge}
        style={{ fontWeight }}
        innerDivStyle={{ padding: '16px 16px 16px 72px' }}
      />
    );
  }
}