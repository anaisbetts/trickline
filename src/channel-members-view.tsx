// tslint:disable-next-line:no-unused-variable
import * as React from 'react';
import { List } from 'react-virtualized';

import { Api } from './lib/models/slack-api';
import { UserViewModel, UserListItem } from './user-list-item';
import { ViewModelListHelper } from './lib/collection-view';
import { Model } from './lib/model';
import { Store } from './lib/store';
import { HasViewModel, SimpleView } from './lib/view';

export class ChannelMembersViewModel extends Model {
  constructor(
    public readonly store: Store,
    public readonly api: Api,
    public readonly members: Array<string>) { super(); }
}

export class ChannelMembersView extends SimpleView<ChannelMembersViewModel> {
  viewModelCache: ViewModelListHelper<ChannelMembersViewModel, HasViewModel<ChannelMembersViewModel>, null>;
  listRef: List;

  constructor(props: { viewModel: ChannelMembersViewModel }, context?: any) {
    super(props, context);

    this.viewModelCache = new ViewModelListHelper(
      this.lifecycle, props,
      (x: ChannelMembersViewModel) => x.members,
      x => x,
      x => new UserViewModel(this.viewModel!.store, x, this.viewModel!.api));

    const update = () => {
      this.listRef.forceUpdateGrid();
      this.forceUpdate();
    };

    this.viewModelCache.shouldRender.subscribe(() => this.queueUpdate(update));
  }

  rowRenderer({index, key, style}: {index: number, key: any, style: React.CSSProperties}) {
    let vm = this.viewModelCache.getViewModel(index) as UserViewModel;

    return <div key={key} style={style}>
      <UserListItem viewModel={vm} />;
    </div>;
  }

  render() {
    let refBind = (l: List) => this.listRef = l;

    return <List
      ref={refBind}
      width={300}
      height={300}
      rowHeight={32}
      rowRenderer={this.rowRenderer.bind(this)}
      rowCount={this.viewModelCache.getRowCount()}
    />;
  }
}