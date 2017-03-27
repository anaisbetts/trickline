import { NaiveStore, Store } from '../../src/lib/store';
import { DexieStore } from '../../src/lib/dexie-store';
import { describeIntegration, expect } from '../support';
import { fetchInitialChannelList, getNextPageNumber } from '../../src/lib/store-network';

import '../../src/lib/custom-operators';
import { timestampToPage, dateToTimestamp } from '../../src/lib/models/slack-api';

const toTest = {
  'NaiveStore': NaiveStore,
  'DexieStore': DexieStore
};

const d = require('debug')('trickline-test:store-integration');

Object.keys(toTest).forEach((k) => {
  let fixture: Store;

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
      fixture = new Klass(tokens);
    });

    it('should fetch messages for the first channel in the store', async function() {
      let channelChanges = fixture.joinedChannels.createCollection();
      expect(channelChanges.length).to.equal(1);

      d('Fetching Initial Channel List');
      await fetchInitialChannelList(fixture);
      expect(channelChanges.length === 2).to.be.true;
      expect(fixture.channels.listenAll().size > 0);

      d(`Getting channel ${fixture.joinedChannels.value[0]} out of the store`);
      let channel = await fixture.channels.get(fixture.joinedChannels.value[0], null);
      expect(channel).to.be.ok;
      expect(channel.api).to.be.ok;

      let nowPage = timestampToPage(dateToTimestamp(new Date()));

      d(`Getting the previous page from ${nowPage}`);
      let page = await getNextPageNumber(fixture, fixture.joinedChannels.value[0], nowPage, false, channel.api);
      expect(page <= nowPage).to.be.true;

      d(`Fetching the messages for ${page}`);
      let messageList = await fixture.messagePages.get({channel: channel.id, page}, channel.api);
      expect(messageList.length > 0).to.be.true;
    });
  });
});