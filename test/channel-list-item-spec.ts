import { expect } from './support';
import { MockStore } from './lib/mock-store';
import { Store } from '../src/lib/store';
import { ChannelBase } from '../src/lib/models/api-shapes';
import { IChannelList } from '../src/channel-list';
import { ChannelViewModel } from '../src/channel-list-item';
import { waitForPropertyChange } from './support';

import { channels, joinedChannels } from './channel-list-spec';

describe('the ChannelViewModel', () => {
  let store: Store, parent: IChannelList, fixture: ChannelViewModel;

  beforeEach(() => {
    store = new MockStore({ channels });
    parent = new MockChannelList();
  });

  function makeViewModelForChannelId(channelId: string): ChannelViewModel {
    return new ChannelViewModel(store, parent, store.channels.listen(channelId));
  }

  it('should reflect the properties of the model', async () => {
    fixture = makeViewModelForChannelId(joinedChannels[0]);
    await waitForPropertyChange(fixture);
    expect(fixture.starred).not.to.be.ok;
    expect(fixture.mentions).to.equal(4);

    fixture = makeViewModelForChannelId(joinedChannels[1]);
    await waitForPropertyChange(fixture);
    expect(fixture.starred).to.be.ok;
    expect(fixture.mentions).not.to.be.ok;
  });

  it("should change the parent's selected channel", async () => {
    fixture = makeViewModelForChannelId(joinedChannels[0]);
    expect(parent.selectedChannel).not.to.be.ok;
    await waitForPropertyChange(fixture);
    fixture.selectChannel.execute();
    expect(parent.selectedChannel!.id).to.equal(joinedChannels[0]);
  });
});

class MockChannelList implements IChannelList {
  selectedChannel: ChannelBase | undefined;
  setSelectedChannel(channel: ChannelBase) {
    this.selectedChannel = channel;
  }
}