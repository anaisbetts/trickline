import { Observable } from 'rxjs/Observable';
import { AsyncSubject } from 'rxjs/AsyncSubject';

import Dexie from 'dexie';

import { InMemorySparseMap, LRUSparseMap, Pair, SparseMap } from './lib/sparse-map';
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

export interface DeferredPutItem<T> {
  item: T;
  completion: AsyncSubject<void>;
}

Dexie.Promise = window.Promise;

declare module 'dexie' {
  module Dexie {
    interface Table<T, Key> {
      getWithApi: ((key: Key) => Promise<T>);
      deferredPut: ((item: T) => Promise<void>);
      idleHandle: number | null;
      deferredItems: DeferredPutItem<T>[];
    }
  }
}

async function getWithApi<T, Key>(this: Dexie.Table<T, Key>, key: Key): Promise<T> {
  let ret = await this.get(key);
  if (!ret) return ret;

  if (ret.token) {
    ret.api = createApi(ret.token);
    delete ret.token;
  }

  return ret;
}

function deferredPut<T, Key>(this: Dexie.Table<T, Key>, item: T): Promise<void> {
  let newItem = { item, completion: new AsyncSubject<void>() };

  if (item.token && !item.api) return Promise.resolve();
  if (!item.api) {
    return Promise.reject(new Error(`Saved Item with ID ${item.id} doesn't have an API`));
  }

  let createIdle = () => window.requestIdleCallback(deadline => {
    while (deadline.timeRemaining() > 5/*ms*/) {
      let itemsToAdd = this.deferredItems;
      this.deferredItems = itemsToAdd.splice(128);

      try {
        let toAdd = itemsToAdd.map(x => {
          return Object.assign({}, x.item, { api: null, token: x.item.api.token() });
        });

        this.bulkPut(toAdd);
        itemsToAdd.forEach(x => { x.completion.next(undefined); x.completion.complete(); });
      } catch (e) {
        itemsToAdd.forEach(x => { x.completion.error(e); });
      }
    }

    if (this.deferredItems.length) {
      this.idleHandle = createIdle();
    } else {
      this.idleHandle = null;
    }
  });

  this.deferredItems = this.deferredItems || [];
  this.deferredItems.push(newItem);
  if (!this.idleHandle) {
    this.idleHandle = createIdle();
  }

  return newItem.completion.toPromise();
}

export class DataModel extends Dexie  {
  users: Dexie.Table<User, string>;
  channels: Dexie.Table<ChannelBase, string>;
  keyValues: Dexie.Table<Pair<string, string>, string>;

  constructor() {
    super('SparseMap');

    this.version(VERSION).stores({
      users: 'id,name,real_name,color,profile,token',
      channels: 'id,name,is_starred,unread_count_display,mention_count,dm_count,user,topic,purpose,token',
      keyValues: 'key,value'
    });

    // XXX: This hack is horrendous
    Object.getPrototypeOf(this.users).deferredPut = deferredPut;
    Object.getPrototypeOf(this.users).getWithApi = getWithApi;
    Dexie.Promise = window.Promise;
  }
}

export class Store {
  api: Api[];
  database: DataModel;

  channels: SparseMap<string, ChannelBase>;
  users: SparseMap<string, User>;
  events: SparseMap<EventType, Message>;
  joinedChannels: Updatable<ChannelList>;
  keyValueStore: SparseMap<string, any>;

  constructor(tokenList: string[] = []) {
    this.api = tokenList.map(x => createApi(x));
    this.database = new DataModel();
    this.database.open();

    this.channels = new LRUSparseMap<ChannelBase>(async (channel, api: Api) => {
      if (!api) throw new Error('You must provide the API object as a hint to listen');

      let ret = await this.database.channels.getWithApi(channel);
      if (ret) return ret;

      return await this.infoApiForModel(channel, api)!();
    }, 'merge');

    this.channels.created
      .flatMap(u => u.Value)
      .flatMap(async v => {
        try {
          await this.database.channels.deferredPut(v);
        } catch (e) {
          console.log(`Can't save channel info! ${e.message}`);
        }
      })
      .subscribe();

    this.users = new LRUSparseMap<User>(async (user, api: Api) => {
      if (!api) throw new Error('You must provide the API object as a hint to listen');

      let ret = await this.database.users.getWithApi(user);
      if (ret) return ret;

      ret = (await api.users.info({ user }).toPromise()).user;
      ret.api = api;
      return ret;
    }, 'merge');

    this.users.created
      .flatMap(u => u.Value)
      .flatMap(async v => {
        try {
          await this.database.users.deferredPut(v);
        } catch (e) {
          console.log(`Can't save user info! ${e.message}`);
        }
      })
      .subscribe();

    this.keyValueStore = new LRUSparseMap<string>((key) =>
      this.database.keyValues.get(key).then(x => x ? JSON.parse(x.Value) : null));

    this.keyValueStore.created
      .flatMap(x => x.Value.map(v => ({ Key: x.Key, Value: JSON.stringify(v) })))
      .flatMap(x => this.database.keyValues.deferredPut(x))
      .subscribe();

    this.joinedChannels = new Updatable<ChannelList>();

    this.events = new InMemorySparseMap<EventType, Message>();
    this.events.listen('user_change')
      .subscribe(msg => {
        if (!msg || !msg.user) return;

        msg.user.api = msg.api;

        let ret = this.users.listen((msg.user as User).id, msg.api, true);
        if (ret) ret.next(msg.user as User);
      });

    // NB: This is the lulzy way to update channel counts when marks
    // change, but we should definitely remove this code later
    let somethingMarked = Observable.merge(
      this.events.listen('channel_marked'),
      this.events.listen('im_marked'),
      this.events.listen('group_marked')
    ).filter(x => x !== null);

    somethingMarked.throttleTime(3000)
      .filter(x => x && x.api)
      .subscribe(x => this.fetchSingleInitialChannelList(x.api));

    this.connectToRtm()
      .groupBy(x => x.type)
      .publish().refCount()
      .retry()
      .do(x => console.log(`Group! ${x.key}`))
      .subscribe(x =>
        x.subscribe(n => this.events.listen(x.key).next(n)));
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

  async updateChannelToLatest(id: string, api: Api) {
    this.channels.listen(id, api).nextAsync(this.infoApiForModel(id, api)!());
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

    updater.next(model);
    return updater;
  }

  private infoApiForModel(id: string, api: Api): (() => (Promise<ChannelBase>|Observable<ChannelBase>)) | null {
    if (!api) throw new Error("Can't call infoApiForModel with null");

    if (isChannel(id)) {
      return async () => {
        let ret = await api.channels.info({ channel: id }).toPromise();
        if (!ret || !ret.channel) return null;

        return Object.assign(ret.channel, { api });
      };
    } else if (isGroup(id)) {
      return async () => {
        let ret = await api.groups.info({ channel: id }).toPromise();
        if (!ret || !ret.group) return null;

        return Object.assign(ret.group, { api });
      };
    } else if (isDM(id)) {
      return () => Observable.empty();
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