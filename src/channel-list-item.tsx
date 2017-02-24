// tslint:disable-next-line:no-unused-variable
import * as React from 'react';
import { ListItem } from 'material-ui/List';
import Star from 'material-ui/svg-icons/toggle/star';

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

    this.when('model.dm_count', 'model.mention_count_display',
      (dmCount, mentions) => (dmCount.value || 0) + (mentions.value || 0))
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
    let mention = null;

    if (viewModel.mentions > 0) {
      const mentionStyle = {
        backgroundColor: 'red',
        color: 'white',
        padding: '2px',
        borderRadius: '6px',
        marginRight: '4px'
      };

      mention = (
        <span style={mentionStyle}>
          {viewModel.mentions}
        </span>
      );
    }

    const fontWeight = viewModel.highlighted ? 'bold' : 'normal';
    const starIcon = viewModel.starred ?
      <Star style={{ height: '16px', marginTop: '6px' }}/> :
      null;

    return (
      <ListItem
        primaryText={viewModel.displayName}
        style={{ height: '28px', fontWeight }}
        innerDivStyle={{ height: '24x', padding: '6px' }}
        secondaryText={mention}
        rightIcon={starIcon}
      />
    );
  }
}