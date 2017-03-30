import { Observable } from 'rxjs/Observable';
import { Subscription } from 'rxjs/Subscription';

import { Api, infoApiForChannel, fetchMessagesForPage, timestampToPage, fetchMessagesPastPage } from './models/slack-api';
import { UsersCounts, Message } from './models/api-shapes';
import { EventType } from './models/event-type';
import { Store, MessageKey } from './store';

import 'rxjs/add/observable/dom/webSocket';
import './standard-operators';
import './custom-operators';

const d = require('debug')('trickline:store-network');

/*
 * users.counts
 */

export async function fetchInitialChannelList(store: Store): Promise<void> {
  let storedChannels = await store.keyValueStore.get('joinedChannels') as string[];

  if (storedChannels) {
    store.joinedChannels.next(storedChannels);
  }

  let channelList = await Observable.from(store.api)
    .flatMap(x => fetchSingleInitialChannelList(store, x))
    .reduce((acc, x) => { acc.push(...x); return acc; }, [])
    .toPromise();

  d(`Setting joinedChannels in store`);
  store.setKeyInStore('joinedChannels', channelList);
  store.joinedChannels.next(channelList);
}

async function fetchSingleInitialChannelList(store: Store, api: Api): Promise<string[]> {
  const joinedChannels: string[] = [];

  const result: UsersCounts = await api.users.counts({ simple_unreads: true }).toPromise();

  d(`Fetching channels for ${api.token()}`);
  result.channels.forEach((c) => {
    c.api = api;

    store.saveModelToStore('channel', c, api);
    joinedChannels.push(c.id);
  });

  result.groups.forEach((g) => {
    g.api = api;

    store.saveModelToStore('channel', g, api);
    joinedChannels.push(g.id);
  });

  result.ims.forEach((dm) => {
    dm.api = api;

    store.saveModelToStore('channel', dm, api);
    joinedChannels.push(dm.id);
  });

  return joinedChannels;
}

export async function updateChannelToLatest(store: Store, id: string, api: Api) {
  store.saveModelToStore('channel', await (infoApiForChannel(id, api).toPromise()), api);
}

export async function fetchMessagePageForChannel(store: Store, channel: string, page: number, api: Api): Promise<MessageKey[]> {
  let result = await fetchMessagesForPage(channel, page, api).toPromise();
  result.forEach(msg => store.saveModelToStore('message', msg, api));

  return result
    .filter(x => timestampToPage(x.ts) === page)
    .map(x => ({ channel, timestamp: x.ts }));
}

export async function getNextPageNumber(
    store: Store,
    channel: string, currentPage: number,
    directionIsForward: boolean,
    api: Api): Promise<number> {
  let result = await fetchMessagesPastPage(channel, currentPage, directionIsForward, api).toPromise();
  result.messages.forEach(msg => store.saveModelToStore('message', msg, api));

  return result.page;
}


/*
 * rtm handling
 */

export function handleRtmMessagesForStore(rtm: Observable<Message>, store: Store): Subscription {
  const ret = new Subscription();

  // Play RTM events onto store.events, grouped by type
  ret.add(rtm
    .groupBy(x => x.type)
    .subscribe(x => x.multicast(store.events.listen(x.key)).connect()));

  // Play user updates onto the user store
  ret.add(store.events.listen('user_change')
    .skip(1)
    .subscribe(msg => store.saveModelToStore('user', msg.user, msg.api)));

  // Subscribe to Flannel messages
  ret.add(store.events.listen('message')
    .subscribe(msg => {
      if (!msg) return;

      if (msg.annotations) {
        Object.keys(msg.annotations).forEach(id => {
          let u = msg.annotations[id];
          u.id = id; u.api = msg.api;

          store.saveModelToStore('user', u, msg.api);
        });

        delete msg.annotations;
      }

      store.saveModelToStore('message', msg, msg.api);
    }));

  // NB: This is the lulzy way to update channel counts when marks
  // change, but we should definitely remove this code later
  let somethingMarked = Observable.merge(
    store.events.listen('channel_marked'),
    store.events.listen('im_marked'),
    store.events.listen('group_marked')
  ).skip(3);

  ret.add(somethingMarked.guaranteedThrottle(3000)
    .subscribe(x => fetchSingleInitialChannelList(store, x.api)));

  // Here, msg.channel is a channel object
  let channelChange: EventType[] = ['channel_joined', 'channel_rename', 'group_joined', 'group_rename'];
  ret.add(Observable.merge(...channelChange.map(x => store.events.listen(x).skip(1)))
    .subscribe(x => {
      x.channel.api = msg.api;
      store.saveModelToStore('channel', x.channel, msg.api);

      // NB: This is slow and dumb
      let idx = store.joinedChannels.value.indexOf(x.channel.id);
      if (idx < 0) store.joinedChannels.value.push(x.channel.id);
      Platform.performMicrotaskCheckpoint();
    }));

  // ...but here, msg.channel is an ID. Ha Ha.
  let channelRemove: EventType[] = ['channel_left', 'channel_deleted', 'group_left', 'im_close'];
  ret.add(Observable.merge(...channelRemove.map(x => store.events.listen(x).skip(1)))
    .subscribe(x => {
      // NB: This is slow and dumb
      let idx = store.joinedChannels.value.indexOf(x.channel);
      if (idx >= 0) store.joinedChannels.value.splice(idx, 1);
      Platform.performMicrotaskCheckpoint();
    }));

  return ret;
}

export function connectToRtm(apis: Api[]): Observable<Message> {
  return Observable.merge(
    ...apis.map(x => createRtmConnection(x).retry(5).catch(e => {
      console.log(`Failed to connect via token ${x.token()} - ${e.message}`);
      return Observable.empty();
    })));
}

function createRtmConnection(api: Api): Observable<Message> {
  return api.rtm.connect()
    .flatMap(({url}) => {

      const flannelizer = (url.indexOf('?') > 0) ?
        `&flannel=1&token=${api.token()}` :
        `?flannel=1&token=${api.token()}`;

      let ret = Observable.webSocket(`${url}${flannelizer}`);
      api.setSocket(ret);
      return ret;
    })
    .map(msg => { msg.api = api; return msg; });
}