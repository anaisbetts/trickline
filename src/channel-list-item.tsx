// tslint:disable-next-line:no-unused-variable
import * as React from 'react';
import { ListItem } from 'material-ui/List';

import { SimpleView } from './lib/view';
import { fromObservable, notify, Model } from './lib/model';
import { Updatable } from './lib/sparse-map';

import { ChannelBase } from './lib/models/api-shapes';

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

    this.when('model.name').map((n: any) => {
      return n.value.length < 25 ?
        n.value :
        `${n.value.substr(0, 25)}...`;
    }).toProperty(this, 'truncatedName');
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

    return (
      <ListItem
        primaryText={viewModel.truncatedName}
        style={{ height: '28px', fontWeight }}
        innerDivStyle={{ height: '24x', padding: '6px' }}
        secondaryText={mention}
      />
    );
  }
}