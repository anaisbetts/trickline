// tslint:disable-next-line:no-unused-variable
import * as React from 'react';
import Avatar from 'material-ui/Avatar';
import { ListItem } from 'material-ui/List';
import Star from 'material-ui/svg-icons/toggle/star';
import { grey700, pinkA200, transparent } from 'material-ui/styles/colors';

import { SimpleView } from './lib/view';
import { fromObservable, notify, Model } from './lib/model';
import { Store } from './lib/store';
import { Updatable } from './lib/updatable';
import { isDM } from './channel-utils';

import { ChannelBase } from './lib/models/api-shapes';

@notify('isSelected')
export class ChannelViewModel extends Model {
  isSelected: boolean;

  @fromObservable model: ChannelBase;
  @fromObservable id: string;
  @fromObservable displayName: string;
  @fromObservable profileImage: string;
  @fromObservable mentions: number;
  @fromObservable highlighted: boolean;
  @fromObservable starred: boolean;

  constructor(public readonly store: Store, model: Updatable<ChannelBase>) {
    super();
    this.store = store;

    model.toProperty(this, 'model');

    this.when('model.id')
      .map((id: any) => id.value)
      .toProperty(this, 'id');

    this.when('model.name')
      .map((n: any) => this.getDisplayName(n.value))
      .toProperty(this, 'displayName');

    this.when('model')
      .filter((c: any) => isDM(c.value))
      .switchMap((c: any) => this.store.users.listen(c.value.user_id))
      .map((res) => res.user.profile.image_48)
      .toProperty(this, 'profileImage');

    this.when('model.is_starred')
      .map((starred: any) => starred.value)
      .toProperty(this, 'starred');

    this.when('model.mention_count')
      .map((c: any) => c.value)
      .toProperty(this, 'mentions');

    this.when('mentions', 'model.has_unreads',
      (mentions, hasUnreads) => mentions.value > 0 || hasUnreads.value)
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
    const offsetStyle = { top: '4px' };

    let leftAvatar = null;
    if (viewModel.starred) {
      leftAvatar = <Star style={offsetStyle} color={grey700}/>;
    } else if (viewModel.profileImage) {
      leftAvatar = (
        <Avatar
          src={viewModel.profileImage}
          style={offsetStyle}
          size={24}
        />
      );
    } else {
      leftAvatar = (
        <Avatar
          color={grey700} backgroundColor={transparent}
          style={offsetStyle}
          size={24}
        >
          #
        </Avatar>
      );
    }

    const mentionsBadge = viewModel.mentions > 0 ? (
      <Avatar
        backgroundColor={pinkA200}
        style={offsetStyle}
        size={24}
      >
        {viewModel.mentions}
      </Avatar>
    ) : null;

    return (
      <ListItem
        primaryText={viewModel.displayName}
        leftAvatar={leftAvatar}
        rightAvatar={mentionsBadge}
        style={{ fontWeight }}
        innerDivStyle={{ padding: '8px 8px 8px 60px' }}
      />
    );
  }
}