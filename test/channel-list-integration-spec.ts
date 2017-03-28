import { describeIntegration, expect } from './support';
import { NaiveStore, Store } from '../src/lib/store';
import { DexieStore } from '../src/lib/dexie-store';
import { fetchInitialChannelList } from '../src/lib/store-network';
import { whenArray } from '../src/lib/when';
import { ChannelListViewModel } from '../src/channel-list';

const toTest = {
  'NaiveStore': NaiveStore,
  'DexieStore': DexieStore
};

//const d = require('debug')('trickline-test:channel-list-integration');

Object.keys(toTest).forEach((k) => {
  let store: Store;
  let fixture: ChannelListViewModel;

  describeIntegration(`The ${k} class`, function() {
    this.timeout(10 * 1000);

    beforeEach(async function() {
      const tokenSource = process.env.SLACK_API_TEST_TOKEN || process.env.SLACK_API_TOKEN;
      const tokens = tokenSource.indexOf(',') >= 0 ? tokenSource.split(',') : [tokenSource];

      await new Promise((res) => {
        const wnd = require('electron').remote.getCurrentWindow();
        wnd.webContents.session.clearStorageData({ origin: window.location.origin, storages: ['indexdb']}, res);
      });

      const Klass = toTest[k];
      store = new Klass(tokens);

      fixture = new ChannelListViewModel(store);
    });

    it('should fetch a list of channels', async function() {
      await fetchInitialChannelList(store);
      await whenArray(fixture, x => x.orderedChannels).filter(() => fixture.orderedChannels.length > 0).take(1).toPromise();
      expect(fixture.orderedChannels.length > 0).to.be.true;
    });
  });
});
