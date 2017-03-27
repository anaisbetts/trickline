import { describeIntegration, expect } from './support';
import { NaiveStore, Store } from '../src/lib/store';
import { DexieStore } from '../src/lib/dexie-store';
import { MessagesViewModel } from '../src/messages-view';
import { fetchInitialChannelList } from '../src/lib/store-network';
import { whenArray } from '../src/lib/when';

const toTest = {
  'NaiveStore': NaiveStore,
  'DexieStore': DexieStore
};

const d = require('debug')('trickline-test:messages-view-integration');

Object.keys(toTest).forEach((k) => {
  let store: Store;
  let fixture: MessagesViewModel;

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

      await fetchInitialChannelList(store);
      let channel = await store.channels.get(store.joinedChannels.value[0], store.api[0]);
      fixture = new MessagesViewModel(store, channel!);
    });

    it('should fetch a list of initial messages', async function() {
      fixture.scrollPreviousPage.execute().subscribe(p => d(`New page is ${p}`));
      await whenArray(fixture, x => x.messages).skip(1).take(1).toPromise();

      expect(fixture.messages.length > 0).to.be.true;
    });
  });
});