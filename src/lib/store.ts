import { Subscription } from 'rxjs/Subscription';
import { Observable } from 'rxjs/Observable';

import { SparseMap, InMemorySparseMap } from './sparse-map';
import { Api, createApi, infoApiForChannel } from './models/slack-api';
import { ChannelBase, Message, User, UsersCounts } from './models/api-shapes';
import { EventType } from './models/event-type';
import { ArrayUpdatable } from './updatable';

import 'rxjs/add/observable/dom/webSocket';
import './standard-operators';
import './custom-operators';

export interface Range<T> {
  oldest: T;
  latest: T;
}

export interface MessagesKey {
  channel: string;
  latest?: string;
}

export type MessageCollection = Range<string> & {
  messages: Array<Message>;
  api: Api;
};

export interface Store {
  api: Api[];

  channels: SparseMap<string, ChannelBase>;
  users: SparseMap<string, User>;
  messages: SparseMap<MessagesKey, MessageCollection>;
  events: SparseMap<EventType, Message>;
  joinedChannels: ArrayUpdatable<string>;
  keyValueStore: SparseMap<string, any>;

  fetchInitialChannelList(): Promise<void>;
}

export class NaiveStore implements Store {
  api: Api[];

  joinedChannels: ArrayUpdatable<string>;
  channels: SparseMap<string, ChannelBase>;
  users: SparseMap<string, User>;
  messages: SparseMap<MessagesKey, MessageCollection>;
  events: SparseMap<EventType, Message>;
  keyValueStore: SparseMap<string, any>;

  constructor(tokenList: string[] = []) {
    this.api = tokenList.map(x => createApi(x));

    this.channels = new InMemorySparseMap((id: string, api: Api) => infoApiForChannel(id, api).toPromise(), 'merge');
    this.users = new InMemorySparseMap<string, User>(
      (user: string, api: Api) => api.users.info({user}).map((x: any) => x.user! as User).toPromise(),
      'merge');

    this.messages = new InMemorySparseMap<MessagesKey, MessageCollection>((key: MessagesKey, api: Api) => {
      return api.channels.history(key).map(({ messages }: { messages: Array<Message> }) => {
        console.log(`latest: ${messages[0].ts}`);
        console.log(`oldest: ${messages[messages.length - 1].ts}`);

        return {
          latest: messages[0].ts,
          oldest: messages[messages.length - 1].ts,
          messages,
          api
        };
      });
    }, 'merge');

    this.events = new InMemorySparseMap<EventType, Message>();
    this.joinedChannels = new ArrayUpdatable<string>();
    this.keyValueStore = new InMemorySparseMap<string, any>();

    // NB: This is the lulzy way to update channel counts when marks
    // change, but we should definitely remove this code later
    let somethingMarked = Observable.merge(
      this.events.listen('channel_marked'),
      this.events.listen('im_marked'),
      this.events.listen('group_marked')
    ).skip(3);

    somethingMarked.guaranteedThrottle(3000)
      .subscribe(x => this.fetchSingleInitialChannelList(x.api));
  }

  async fetchInitialChannelList(): Promise<void> {
    let channelList = await Observable.from(this.api)
      .flatMap(x => this.fetchSingleInitialChannelList(x))
      .reduce((acc, x) => { acc.push(...x); return acc; }, [])
      .toPromise();

    this.joinedChannels.next(channelList);
  }

  private makeUpdatableForModel(model: ChannelBase & Api, api: Api) {
    model.api = api;

    const updater = this.channels.listen(model.id, api);
    updater.next(model);
    return updater;
  }

  private async fetchSingleInitialChannelList(api: Api): Promise<string[]> {
    const joinedChannels: string[] = [];

    const result: UsersCounts = await api.users.counts({ simple_unreads: true }).toPromise();

    result.channels.forEach((c) => {
      this.channels.setDirect(c.id, this.makeUpdatableForModel(c, api));
      joinedChannels.push(c.id);
    });

    result.groups.forEach((g) => {
      this.channels.setDirect(g.id, this.makeUpdatableForModel(g, api));
      joinedChannels.push(g.id);
    });

    result.ims.forEach((dm) => {
      this.channels.setDirect(dm.id, this.makeUpdatableForModel(dm, api));
      joinedChannels.push(dm.id);
    });

    return joinedChannels;
  }

  updateChannelToLatest(id: string, api: Api) {
    this.channels.listen(id).nextAsync(infoApiForChannel(id, api));
  }
}

export function handleRtmMessagesForStore(rtm: Observable<Message>, store: Store): Subscription {
  const ret = new Subscription();

  // Play RTM events onto store.events, grouped by type
  ret.add(rtm
    .groupBy(x => x.type)
    .subscribe(x => x.multicast(store.events.listen(x.key)).connect()));

  // Play user updates onto the user store
  ret.add(store.events.listen('user_change')
    .skip(1)
    .subscribe(msg => store.users.listen((msg.user! as User).id, msg.api).next(msg.user as User)));

  // Subscribe to Flannel annotations
  ret.add(store.events.listen('message')
    .filter(x => x && x.annotations)
    .subscribe(msg => {
      Object.keys(msg.annotations).forEach(id => {
        store.users.listen(id, msg.api).next(msg.annotations[id]);
      });
    }));

  // Here, msg.channel is a channel object
  let channelChange: EventType[] = ['channel_joined', 'channel_rename', 'group_joined', 'group_rename'];
  ret.add(Observable.merge(...channelChange.map(x => store.events.listen(x).skip(1)))
    .subscribe(x => {
      store.channels.listen(x.channel.id, x.api).next(x.channel);

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