// tslint:disable-next-line:no-unused-variable
import * as React from 'react';

import { SimpleView } from './view';
import { asProperty, Model } from './model';
import { Store } from './store';
import { Updatable } from './sparse-map';

import { ChannelBase } from './models/api-shapes';

export class ChannelListViewModel extends Model {
  store: Store;
  selectedChannel: ChannelBase;
  joinedChannels: Array<Updatable<ChannelBase>>;

  constructor(store: Store) {
    super();
    this.store = store;
  }

  @asProperty
  joinedChannels() { return this.store.joinedChannels; }
}

export class ChannelListView extends SimpleView<ChannelListViewModel> {
  render() {
    let items = this.viewModel.joinedChannels.map(x =>
      <li key={x.value.id}>{x.value.name}</li>
    );

    return <ul>{items}</ul>;
  }
}