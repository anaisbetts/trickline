// tslint:disable-next-line:no-unused-variable
import * as React from 'react';
import Avatar from 'material-ui/Avatar';
import { ListItem } from 'material-ui/List';

import { Api } from './lib/models/slack-api';
import { Model, fromObservable } from './lib/model';
import { SimpleView } from './lib/view';
import { Store } from './lib/store';
import { User } from './lib/models/api-shapes';
import { when } from './lib/when';

const defaultAvatar = require.resolve('./images/default-avatar.png');

export class UserViewModel extends Model {
  @fromObservable model: User;
  @fromObservable displayName: string;
  @fromObservable profileImage: string;

  constructor(public readonly store: Store, id: string, api: Api) {
    super();

    let model = this.store.users.listen(id, api);
    model.toProperty(this, 'model');

    model.pinned = true;
    this.addTeardown(() => model.pinned = false);

    when(this, x => x.model)
      .map(user => user ? user.real_name || user.name : '')
      .toProperty(this, 'displayName');

    when(this, x => x.model)
      .map(user => {
        if (!user) return defaultAvatar;
        return user.profile.image_48;
      })
      .toProperty(this, 'profileImage');
  }
}

export class UserListItem extends SimpleView<UserViewModel> {
  render() {
    const viewModel = this.props.viewModel;
    const offsetStyle = { top: '4px' };

    let leftAvatar = null;
    if (viewModel.profileImage) {
      leftAvatar = (
        <Avatar
          src={viewModel.profileImage}
          style={offsetStyle}
          size={24}
        />
      );
    }

    return (
      <ListItem
        primaryText={viewModel.displayName}
        leftAvatar={leftAvatar}
        disabled={true}
        innerDivStyle={{ padding: '8px 8px 8px 60px' }}
      />
    );
  }
}
