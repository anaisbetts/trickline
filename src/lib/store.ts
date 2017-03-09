import { Subscription } from 'rxjs/Subscription';
import { Observable } from 'rxjs/Observable';

import { SparseMap, InMemorySparseMap } from './sparse-map';
import { Updatable } from './updatable';
import { Api, createApi, infoApiForChannel } from './models/slack-api';
import { ChannelBase, Message, User, UsersCounts } from './models/api-shapes';
import { EventType } from './models/event-type';
import { asyncMap } from './promise-extras';

import 'rxjs/add/observable/dom/webSocket';
import './standard-operators';
import './custom-operators';

export type ChannelList = Array<Updatable<ChannelBase|null>>;

export interface Store {
  api: Api[];

  channels: SparseMap<string, ChannelBase>;
  users: SparseMap<string, User>;
  events: SparseMap<EventType, Message>;
  joinedChannels: Updatable<ChannelList>;
  keyValueStore: SparseMap<string, any>;

  fetchInitialChannelList(): Promise<void>;
}

export class NaiveStore implements Store {
  api: Api[];

  channels: SparseMap<string, ChannelBase>;
  users: SparseMap<string, User>;
  messages: SparseMap<string, Array<Message>>;
  events: SparseMap<EventType, Message>;
  joinedChannels: Updatable<ChannelList>;
  keyValueStore: SparseMap<string, any>;

  constructor(tokenList: string[] = []) {
    this.api = tokenList.map(x => createApi(x));

    this.channels = new InMemorySparseMap((id: string, api: Api) => infoApiForChannel(id, api).toPromise(), 'merge');
    this.users = new InMemorySparseMap<string, User>(
      (user: string, api: Api) => api.users.info({user}).map((x: any) => x.user! as User).toPromise(),
      'merge');
    this.messages = new InMemorySparseMap<string, Array<Message>>((channel, api: Api) => {
      return api.channels.history({ channel }).map(({ messages }: { messages: Array<Message> }) => {
        messages.api = api;
        return messages;
      });
    }, 'merge');
    this.events = new InMemorySparseMap<EventType, Message>();
    this.joinedChannels = new Updatable<ChannelList>();
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
    const results = await asyncMap(this.api, (api) => this.fetchSingleInitialChannelList(api));

    const allJoinedChannels = Array.from(results.values())
      .reduce((acc, x) => acc.concat(x), []);

    this.joinedChannels.next(allJoinedChannels);
  }

  private makeUpdatableForModel(model: ChannelBase & Api, api: Api) {
    model.api = api;

    const updater = this.channels.listen(model.id, api);
    updater.next(model);
    return updater;
  }

  private async fetchSingleInitialChannelList(api: Api): Promise<ChannelList> {
    const joinedChannels: ChannelList = [];

    const result: UsersCounts = await api.users.counts({ simple_unreads: true }).toPromise();

    result.channels.forEach((c) => {
      joinedChannels.push(this.makeUpdatableForModel(c, api));
    });

    result.groups.forEach((g) => {
      joinedChannels.push(this.makeUpdatableForModel(g, api));
    });

    result.ims.forEach((dm) => {
      joinedChannels.push(this.makeUpdatableForModel(dm, api));
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

  return ret;
}

export function connectToRtm(apis: Api[]): Observable<Message> {
  return Observable.merge(
    ...apis.map(x => createRtmConnection(x).retry(5).catch(e => {
      console.log(`Failed to connect via token ${x.token()} - ${e.message}`);
      return Observable.empty();
    }))).publish().refCount();
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