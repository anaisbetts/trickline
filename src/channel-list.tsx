// tslint:disable-next-line:no-unused-variable
import * as React from 'react';

import {Observable} from 'rxjs/Observable';

import {List} from 'react-virtualized';
import muiThemeable from 'material-ui/styles/muiThemeable';

import { SimpleView, View } from './view';
import { asProperty, notify, Model } from './model';
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

@notify('isSelected')
export class ChannelViewModel extends Model {
  model: ChannelBase;
  modelSource: Updatable<ChannelBase>;
  isSelected: boolean;
  mentions: number;
  highlighted: boolean;

  constructor(model: Updatable<ChannelBase>) {
    super();

    this.modelSource = model;
  }

  @asProperty model() {
    return this.modelSource;
  }

  @asProperty mentions() {
    return this.when('model.dm_count', 'model.mention_count', (d, m) => (d.value || 0) + (m.value || 0));
  }

  @asProperty highlighted() {
    return this.when('mentions', 'model.unread_count', (m, u) =>  m.value > 0 || ((u.value || 0) > 0));
  }
}

class ChannelListItem extends View<ChannelViewModel, {viewModel: ChannelViewModel, muiTheme: any}> {
  render() {
    const vm = this.props.viewModel;
    const accent = this.props.muiTheme.palette.accent1Color;

    const mention = vm.mentions > 0 ?
      <span style={{backgroundColor: accent, color: 'white', padding: '2px', borderRadius: '6px', marginRight: '4px'}}>
        {vm.mentions}
      </span> :
      null;

    const content = <span style={{fontWeight: vm.highlighted ? 'bold' : 'normal'}}>{vm.model.name}</span>;

    return <li>{mention}{content}</li>;
  }
}

export const ChannelListItemThemed = muiThemeable()(ChannelListItem);

export class ChannelListView extends SimpleView<ChannelListViewModel> {
  rowRenderer(opts: any): JSX.Element {
    let {index, key, style, isScrolling} = opts;
    let item = this.viewModel.joinedChannels[index];

    return <ChannelListItemThemed key={item.value.id} style={style} viewModel={new ChannelViewModel(item)} />;
  }

  render() {
    return <List
      width={300}
      height={500}
      rowRenderer={this.rowRenderer.bind(this)}
      rowCount={this.viewModel.joinedChannels.length}
      rowHeight={10}
      />;
  }
}