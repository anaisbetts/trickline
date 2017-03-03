import { Observable } from 'rxjs/Observable';

import Dexie from 'dexie';

import { InMemorySparseMap, LRUSparseMap, SparseMap } from './lib/sparse-map';
import { Updatable } from './lib/updatable';
import { Api, createApi } from './lib/models/api-call';
import { ChannelBase, Message, UsersCounts, User } from './lib/models/api-shapes';
import { EventType } from './lib/models/event-type';
import { asyncMap } from './lib/promise-extras';
import { isChannel, isGroup, isDM } from './channel-utils';

import './lib/standard-operators';
import 'rxjs/add/observable/dom/webSocket';

export type ChannelList = Array<Updatable<ChannelBase|null>>;

const VERSION = 1;

export class DataModel extends Dexie  {
  users: Dexie.Table<User, string>;
  usersSchema: string;

  constructor() {
    super('SparseMap');

    this.usersSchema = 'id,name,real_name,color,profile';
    this.version(VERSION).stores({
      users: this.usersSchema
    });
  }
}

export class Store {
  api: Api[];
  database: DataModel;

  channels: SparseMap<string, ChannelBase>;
  users: SparseMap<string, User>;
  joinedChannels: Updatable<ChannelList>;
  events: SparseMap<EventType, Message>;

  constructor(tokenList: string[] = []) {
    this.api = tokenList.map(x => createApi(x));
    this.database = new DataModel();
    this.database.open();

    this.channels = new LRUSparseMap<ChannelBase>((channel, api: Api) => {
      return this.infoApiForModel(channel, api)();
    }, 'merge');

    this.users = new LRUSparseMap<User>((user, api: Api) => {
      return api.users.info({ user }).map(({ user }: { user: User }) => {
        user.api = api;
        return user;
      });
    }, 'merge');

    this.joinedChannels = new Updatable<ChannelList>(() => Observable.of([]));

    this.events = new InMemorySparseMap<EventType, Message>();
    this.events.listen('user_change')
      .subscribe(msg => this.users.listen((msg.user! as User).id, msg.api).playOnto(Observable.of(msg.user)));

    // NB: This is the lulzy way to update channel counts when marks
    // change, but we should definitely remove this code later
    let somethingMarked = Observable.merge(
      this.events.listen('channel_marked'),
      this.events.listen('im_marked'),
      this.events.listen('group_marked')
    );

    somethingMarked.throttleTime(3000)
      .subscribe(x => this.fetchSingleInitialChannelList(x.api));

    this.connectToRtm()
      .groupBy(x => x.type)
      .publish().refCount()
      .retry()
      .subscribe(x => this.events.listen(x.key).playOnto(x));
  }

  connectToRtm(): Observable<Message> {
    return Observable.merge(
      ...this.api.map(x => this.createRtmConnection(x).retry(5).catch(e => {
        console.log(`Failed to connect via token ${x} - ${e.message}`);
        return Observable.empty();
      })));
  }

  async fetchInitialChannelList(): Promise<void> {
    const results = await asyncMap(this.api, (api) => this.fetchSingleInitialChannelList(api));

    const allJoinedChannels = Array.from(results.values())
      .reduce((acc, x) => acc.concat(x), []);

    this.joinedChannels.next(allJoinedChannels);
  }

  updateChannelToLatest(id: string, api: Api) {
    this.channels.listen(id).playOnto(this.infoApiForModel(id, api)());
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

  private makeUpdatableForModel(model: ChannelBase & Api, api: Api) {
    model.api = api;

    const updater = this.channels.listen(model.id, api);
    updater.playOnto(Observable.of(model));
    return updater;
  }

  private infoApiForModel(id: string, api: Api): () => Observable<ChannelBase|null> {
    if (isChannel(id)) {
      return () => api.channels.info({ channel: id })
        .map((response: any) => Object.assign(response.channel, { api }));
    } else if (isGroup(id)) {
      return () => api.groups.info({ channel: id })
        .map((response: any) => Object.assign(response.group, { api }));
    } else if (isDM(id)) {
      return () => Observable.of(null);
    } else {
      throw new Error(`Unsupported model: ${id}`);
    }
  }

  private createRtmConnection(api: Api): Observable<Message> {
    return api.rtm.connect()
      .flatMap(({url}) => Observable.webSocket(url))
      .map(msg => { msg.api = api; return msg; });
  }
}