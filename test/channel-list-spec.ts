import { expect } from './support';
import { MockStore } from './lib/mock-store';
import { Store } from '../src/lib/store';
import { ChannelBase } from '../src/lib/models/api-shapes';
import { ChannelListViewModel } from '../src/channel-list';
import { waitForPropertyChange } from './support';

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

export const joinedChannels: Array<string> = ['C1971', 'C1999', 'C1968', 'D1987', 'D1980'];

describe('the ChannelListViewModel', () => {
  let store: Store, fixture: ChannelListViewModel;

  beforeEach(() => {
    store = new MockStore({ channels, joinedChannels });
    fixture = new ChannelListViewModel(store);
  });

  it('should filter archived channels and closed DMs', async () => {
    expect(fixture.orderedChannels).to.be.empty;
    await waitForPropertyChange(fixture, 'orderedChannels');
    expect(fixture.orderedChannels.length).to.equal(3);
  });

  it('should sort channels by name, and all DMs below channels', async () => {
    await waitForPropertyChange(fixture, 'orderedChannels');
    expect(fixture.orderedChannels[0].value.name).to.equal('eyes-wide-shut');
    expect(fixture.orderedChannels[1].value.name).to.equal('the-shining');
    expect(fixture.orderedChannels[2].value.name).to.equal('a-clockwork-orange');
  });

  it('should update based on joined channels', async () => {
    await waitForPropertyChange(fixture, 'orderedChannels');
    store.joinedChannels.next(joinedChannels.slice(2));
    await waitForPropertyChange(fixture, 'orderedChannels');
    expect(fixture.orderedChannels.length).to.equal(1);
  });
});