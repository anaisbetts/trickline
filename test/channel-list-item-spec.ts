import { expect } from './support';
import { MockStore } from './lib/mock-store';
import { Store } from '../src/lib/store';
import { ChannelBase } from '../src/lib/models/api-shapes';
import { IChannelList } from '../src/channel-list';
import { ChannelViewModel } from '../src/channel-list-item';
import { getResultAfterChange } from '../src/lib/when';

import { channels, joinedChannels } from './channel-list-spec';
import { users } from './user-list-item-spec';

describe('the ChannelViewModel', () => {
  let store: Store, parent: IChannelList, fixture: ChannelViewModel;

  beforeEach(() => {
    store = new MockStore({ channels, users });
    parent = new MockChannelList();
  });

  function makeViewModelForChannelId(channelId: string): ChannelViewModel {
    return new ChannelViewModel(store, parent, store.channels.listen(channelId));
  }

  it('should reflect the properties of the model', async () => {
    fixture = makeViewModelForChannelId(joinedChannels[0]);
    const mentions = await getResultAfterChange(fixture, x => x.mentions);
    expect(mentions).to.equal(4);

    fixture = makeViewModelForChannelId(joinedChannels[1]);
    const starred = await getResultAfterChange(fixture, x => x.starred);
    expect(starred).to.be.ok;
  });

  it("should change the parent's selected channel", async () => {
    fixture = makeViewModelForChannelId(joinedChannels[0]);
    expect(parent.selectedChannel).not.to.be.ok;
    await getResultAfterChange(fixture, x => x.model);
    fixture.selectChannel.execute();
    expect(parent.selectedChannel!.id).to.equal(joinedChannels[0]);
  });

  it('should use the associated user for the display name in DMs', async () => {
    fixture = makeViewModelForChannelId(joinedChannels[3]);
    const displayName = await getResultAfterChange(fixture, x => x.displayName,
      name => !!name && name !== channels[fixture.id].name);
    expect(displayName.match(/Stanley Kubrick/)).to.be.ok;
  });

  it('should truncate long channel names', async () => {
    fixture = makeViewModelForChannelId('C1964');
    const displayName = await getResultAfterChange(fixture, x => x.displayName);
    expect(displayName).to.equal('dr-strangelove-or-how-i-l...');
  });

  it('should use the profile image from the associated user', async () => {
    fixture = makeViewModelForChannelId(joinedChannels[4]);
    const profileImage = await getResultAfterChange(fixture, x => x.profileImage);
    expect(profileImage.match(/Stanley-Kubrick/)).to.be.ok;
  });
});

class MockChannelList implements IChannelList {
  selectedChannel: ChannelBase | undefined;
  setSelectedChannel(channel: ChannelBase) {
    this.selectedChannel = channel;
  }
}