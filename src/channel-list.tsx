// tslint:disable-next-line:no-unused-variable
import * as React from 'react';

import {Observable} from 'rxjs/Observable';
import {Subscription} from 'rxjs/Subscription';

import { AutoSizer, List } from 'react-virtualized';

import { SimpleView } from './view';
import { fromObservable, notify, Model } from './model';
import { Store } from './store';
import { Updatable } from './sparse-map';

import { ChannelBase } from './models/api-shapes';

export class ChannelListViewModel extends Model {
  store: Store;
  selectedChannel: ChannelBase;
  @fromObservable joinedChannels: Array<Updatable<ChannelBase>>;

  constructor(store: Store) {
    super();
    this.store = store;
    store.joinedChannels.toProperty(this, 'joinedChannels');
  }
}

@notify('isSelected')
export class ChannelViewModel extends Model {
  isSelected: boolean;

  @fromObservable model: ChannelBase;
  @fromObservable mentions: number;
  @fromObservable highlighted: boolean;
  @fromObservable truncatedName: string;

  constructor(model: Updatable<ChannelBase>) {
    super();

    model.toProperty(this, 'model');

    this.when('model.dm_count', 'model.mention_count_display', (d, m) => (d.value || 0) + (m.value || 0))
      .toProperty(this, 'mentions');

    this.when('mentions', 'model.unread_count_display', (m, u) =>  m.value > 0 || ((u.value || 0) > 0))
      .toProperty(this, 'highlighted');

    this.when('model.name').map(n => {
      return n.value.length < 25 ?
        n.value :
        `${n.value.substr(0, 25)}...`;
    }).toProperty(this, 'truncatedName');
  }
}

class ChannelListItem extends SimpleView<ChannelViewModel> {
  render() {
    const vm = this.props.viewModel;
    const mention = vm.mentions > 0 ?
      <span style={{backgroundColor: 'red', color: 'white', padding: '2px', borderRadius: '6px', marginRight: '4px'}}>
        {vm.mentions}
      </span> :
      null;

    const content = <span style={{fontWeight: vm.highlighted ? 'bold' : 'normal'}}>{vm.truncatedName}</span>;

    return <div>{mention}{content}</div>;
  }
}

export class ChannelListView extends SimpleView<ChannelListViewModel> {
  rowRenderer(opts: any): JSX.Element {
    let {index, style} = opts;
    let item = this.viewModel.joinedChannels[index];

    return <div key={item.value.id} style={style}><ChannelListItem viewModel={new ChannelViewModel(item)} /></div>;
  }

  listRenderer(opts: any): JSX.Element {
    let {width, height} = opts;

    return <List
        width={width}
        height={height}
        rowRenderer={this.rowRenderer.bind(this)}
        rowCount={this.viewModel.joinedChannels.length}
        rowHeight={18}
      />;
  }

  render() {
    return <AutoSizer>{this.listRenderer.bind(this)}</AutoSizer>;
  }
}