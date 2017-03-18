import { expect } from './support';
import { MockStore } from './lib/mock-store';
import { Store } from '../src/lib/store';
import { ChannelBase } from '../src/lib/models/api-shapes';
import { ChannelListViewModel } from '../src/channel-list';
import { waitForPropertyChange } from './support';

const channels: { [key: string]: ChannelBase } = {
  C1971: {
    id: 'C1971',
    name: 'A Clockwork Orange'
  },
  C1968: {
    id: 'C1968',
    name: '2001: A Space Odyssey',
    is_archived: true
  },
  D1987: {
    id: 'D1987',
    name: 'Full Metal Jacket',
    is_open: false
  },
  D1980: {
    id: 'D1980',
    name: 'The Shining',
    is_open: true
  }
} as any;

const joinedChannels: Array<string> = ['C1971', 'C1968', 'D1987', 'D1980'];

describe('the ChannelListViewModel', () => {
  let store: Store, fixture: ChannelListViewModel;

  beforeEach(() => {
    store = new MockStore({ channels, joinedChannels });
    fixture = new ChannelListViewModel(store);
  });

  it('should filter archived channels and closed DMs', async () => {
    expect(fixture.orderedChannels).to.be.empty;
    await waitForPropertyChange(fixture, 'orderedChannels');
    expect(fixture.orderedChannels.length).to.equal(2);
  });
});