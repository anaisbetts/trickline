// tslint:disable-next-line:no-unused-variable
import * as React from 'react';
import Avatar from 'material-ui/Avatar';
import { ListItem } from 'material-ui/List';

import { Api } from './lib/models/api-call';
import { Model, fromObservable } from './lib/model';
import { SimpleView } from './lib/view';
import { Store } from './store';
import { User } from './lib/models/api-shapes';
import { when } from './lib/when';

export class UserViewModel extends Model {
  @fromObservable model: User;
  @fromObservable displayName: string;
  @fromObservable profileImage: string;

  constructor(public readonly store: Store, id: string, api: Api) {
    super();

    this.store.users.listen(id, api).toProperty(this, 'model');

    when(this, x => x.model)
      .filter(model => !!model)
      .map(user => user.real_name || user.name)
      .toProperty(this, 'displayName');

    when(this, x => x.model)
      .filter(model => !!model)
      .map(user => user.profile.image_48)
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
