// tslint:disable-next-line:no-unused-variable
import * as React from 'react';

import { Api } from './lib/models/api-call';
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
  viewModelFactory(index: number) {
    return new UserViewModel(
      this.viewModel.store,
      this.viewModel.members[index],
      this.viewModel.api
    );
  }

  renderItem(viewModel: UserViewModel) {
    return <UserListItem viewModel={viewModel} />;
  }

  rowCount() {
    return this.viewModel.members.length;
  }
}