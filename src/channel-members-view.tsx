// tslint:disable-next-line:no-unused-variable
import * as React from 'react';

import { Api } from './lib/models/slack-api';
import { UserViewModel, UserListItem } from './user-list-item';
import { CollectionView } from './lib/collection-view';
import { Model } from './lib/model';
import { Store } from './store';

export class ChannelMembersViewModel extends Model {
  constructor(
    public readonly store: Store,
    public readonly api: Api,
    public readonly members: Array<string>
  ) {
    super();
  }
}

export class ChannelMembersView extends CollectionView<ChannelMembersViewModel, UserViewModel> {
  viewModelFactory(_item: any, index: number) {
    return new UserViewModel(
      this.viewModel.store,
      this.viewModel.members[index],
      this.viewModel.api
    );
  }

  renderItem(viewModel: UserViewModel) {
    return <UserListItem viewModel={viewModel} />;
  }
}