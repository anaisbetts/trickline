import { Observable } from 'rxjs/Observable';
import { Subscription } from 'rxjs/Subscription';

import { Api, infoApiForChannel } from './models/slack-api';
import { UsersCounts, Message } from './models/api-shapes';
import { EventType } from './models/event-type';
import { Store } from './store';

import 'rxjs/add/observable/dom/webSocket';
import './standard-operators';
import './custom-operators';

/*
 * users.counts
 */

export async function fetchInitialChannelList(store: Store): Promise<void> {
  let channelList = await Observable.from(store.api)
    .flatMap(x => fetchSingleInitialChannelList(store, x))
    .reduce((acc, x) => { acc.push(...x); return acc; }, [])
    .toPromise();

  store.joinedChannels.next(channelList);
}

async function fetchSingleInitialChannelList(store: Store, api: Api): Promise<string[]> {
  const joinedChannels: string[] = [];

  const result: UsersCounts = await api.users.counts({ simple_unreads: true }).toPromise();

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
  store.saveModelToStore('channel', await infoApiForChannel(id, api), api);
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

  // Subscribe to Flannel annotations
  ret.add(store.events.listen('message')
    .filter(x => x && x.annotations)
    .subscribe(msg => {
      Object.keys(msg.annotations).forEach(id => {
        let u = msg.annotations[id];
        u.id = id; u.api = msg.api;

        store.saveModelToStore('user', u, msg.api);
      });
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