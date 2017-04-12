import * as React from 'react';

import { expect } from './support';
import { MockStore } from './lib/mock-store';
import { Store } from '../src/lib/store';
import { ChannelBase, User } from '../src/lib/models/api-shapes';
import { ChannelListViewModel, ChannelListView } from '../src/channel-list';
import { getResultAfterChange } from '../src/lib/when';
import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider';

import { mount, render } from 'enzyme';
import { ChannelListItem } from '../src/channel-list-item';

export const channels: { [key: string]: ChannelBase } = {
  C1971: {
    id: 'C1971',
    name: 'the-shining',
    mention_count: 4
  },
  C1999: {
    id: 'C1999',
    name: 'eyes-wide-shut',
    is_starred: true
  },
  C1968: {
    id: 'C1968',
    name: '2001-a-space-odyssey',
    is_archived: true
  },
  C1964: {
    id: 'C1964',
    name: 'dr-strangelove-or-how-i-learned-to-stop-worrying-and-love-the-bomb',
  },
  D1987: {
    id: 'D1987',
    user_id: 'stanleyKubrick',
    name: 'full-metal-jacket',
    is_open: false
  },
  D1980: {
    id: 'D1980',
    user_id: 'stanleyKubrick',
    name: 'a-clockwork-orange',
    is_open: true
  }
} as any;

export const users: { [key: string]: User } = {
  stanleyKubrick: {
    id: 'stanleyKubrick',
    name: 'StanleyKubrick',
    real_name: 'Stanley Kubrick',
    deleted: false,
    profile: {
      first_name: 'Stanley',
      last_name: 'Kubrick',
    }
  }
};

export const joinedChannels: Array<string> = ['C1971', 'C1999', 'C1968', 'D1987', 'D1980'];

describe('the ChannelListViewModel', () => {
  let store: Store, fixture: ChannelListViewModel;

  beforeEach(() => {
    store = new MockStore({ channels, joinedChannels, users });
    fixture = new ChannelListViewModel(store);
  });

  it('should filter archived channels and closed DMs', async () => {
    expect(fixture.orderedChannels).to.be.empty;
    const orderedChannels = await getResultAfterChange(fixture, x => x.orderedChannels);
    expect(orderedChannels.length).to.equal(3);
  });

  it('should sort channels by name, and all DMs below channels', async () => {
    const orderedChannels = await getResultAfterChange(fixture, x => x.orderedChannels);
    expect(orderedChannels[0].value.name).to.equal('eyes-wide-shut');
    expect(orderedChannels[1].value.name).to.equal('the-shining');
    expect(orderedChannels[2].value.name).to.equal('a-clockwork-orange');
  });

  it('should update based on joined channels', async () => {
    store.joinedChannels.next(joinedChannels.slice(2));
    const orderedChannels = await getResultAfterChange(fixture, x => x.orderedChannels);
    expect(orderedChannels.length).to.equal(1);
  });
});

describe('the ChannelListView', () => {
  let store: Store, viewModel: ChannelListViewModel;

  beforeEach(() => {
    store = new MockStore({ channels, joinedChannels, users });
    viewModel = new ChannelListViewModel(store);
  });

  it('should render channel items for each channel', async function() {
    await getResultAfterChange(viewModel, x => x.orderedChannels);

    const result = render(<div style={{width: 1000, height: 1000}}>
      <MuiThemeProvider>
        <ChannelListView viewModel={viewModel} />
      </MuiThemeProvider>
    </div>);

    let text = result.text();
    viewModel.orderedChannels.forEach(x => {
      expect(text).to.contain(x.value.name);
    });
  });

  it('should re-render channels when we change the array', async function() {
    await getResultAfterChange(viewModel, x => x.orderedChannels);

    const result = mount(<div style={{width: 1000, height: 1000}}>
      <MuiThemeProvider>
        <ChannelListView viewModel={viewModel} />
      </MuiThemeProvider>
    </div>);

    expect(result.find(ChannelListItem).length).to.equal(3);

    store.joinedChannels.value.length = 0;
    Platform.performMicrotaskCheckpoint();
    await Promise.resolve(true);

    await getResultAfterChange(viewModel, x => x.orderedChannels);

    expect(viewModel.orderedChannels.length).to.equal(0);
    expect(result.find(ChannelListItem).length).to.equal(0);
  });
});