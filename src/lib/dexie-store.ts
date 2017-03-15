import { Observable } from 'rxjs/Observable';
import { AsyncSubject } from 'rxjs/AsyncSubject';

import Dexie from 'dexie';

import { Store, MessagesKey, MessageCollection, ModelType } from './store';
import { Api, createApi, infoApiForChannel } from './models/slack-api';
import { ArrayUpdatable } from './updatable';
import { SparseMap, InMemorySparseMap } from './sparse-map';
import { ChannelBase, User, Message } from './models/api-shapes';
import { EventType } from './models/event-type';
import { Pair } from './utils';

const VERSION = 1;

export interface DeferredPutItem<T> {
  item: T;
  completion: AsyncSubject<void>;
}

declare module 'dexie' {
  module Dexie {
    interface Table<T, Key> {
      deferredPut: ((item: T) => Promise<void>);
      idleHandle: number | null;
      deferredItems: DeferredPutItem<T>[];
      getOrEmpty: ((key: Key) => Observable<T>);
    }
  }
}

function deferredPut<T, Key>(this: Dexie.Table<T, Key>, item: T): Promise<void> {
  let newItem = { item, completion: new AsyncSubject<void>() };

  let createIdle = () => window.requestIdleCallback(deadline => {
    while (deadline.timeRemaining() > 5/*ms*/) {
      let itemsToAdd = this.deferredItems;
      this.deferredItems = itemsToAdd.splice(128);

      let toPut = itemsToAdd.map(x => {
        let ret = Object.assign({}, x.item);
        if (ret.api) {
          ret.token = ret.api.token();
          ret.api = null;
        }

        return ret;
      });

      this.bulkPut(toPut);
      itemsToAdd.forEach(x => { x.completion.next(undefined); x.completion.complete(); });
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

export class DataModel extends Dexie {
  users: Dexie.Table<User, string>;
  channels: Dexie.Table<ChannelBase, string>;
  keyValues: Dexie.Table<Pair<string, string>, string>;

  constructor() {
    super('SparseMap');

    this.version(VERSION).stores({
      users: 'id,name,real_name,color,profile',
      channels: 'id,name,is_starred,unread_count_display,mention_count,dm_count,user,topic,purpose',
      keyValues: 'Key,Value'
    });

    Object.getPrototypeOf(this.users).deferredPut = deferredPut;
  }
}

export class DexieStore implements Store {
  api: Api[];

  joinedChannels: ArrayUpdatable<string>;
  channels: SparseMap<string, ChannelBase>;
  users: SparseMap<string, User>;
  messages: SparseMap<MessagesKey, MessageCollection>;
  events: SparseMap<EventType, Message>;
  keyValueStore: SparseMap<string, any>;

  private database: DataModel;
  private apiTokenMap: Map<string, Api>;

  constructor(tokenList: string[] = []) {
    this.apiTokenMap = tokenList.reduce((acc, x) => {
      acc.set(x, createApi(x));
      return acc;
    }, new Map());

    this.api = Array.from(this.apiTokenMap.values());

    this.database = new DataModel();
    this.database.open();

    this.channels = new InMemorySparseMap<string, ChannelBase>(async (id, api) => {
      let ret = await this.database.channels.get(id);
      if (ret) {
        if (ret.token) {
          ret.api = this.apiTokenMap.get(ret.api);
          delete ret.token;
        }

        return ret;
      }

      ret = await (infoApiForChannel(id, api).toPromise());
      this.saveModelToStore('channel', ret, api);

      return ret;
    }, 'merge');

    this.users = new InMemorySparseMap<string, User>(async (id, api) => {
      let ret = await this.database.users.get(id);
      if (ret) {
        if (ret.token) {
          ret.api = this.apiTokenMap.get(ret.api);
          delete ret.token;
        }

        return ret;
      }

      ret = (await (api.users.info({user: id}).toPromise())).user;
      ret.api = api;
      this.saveModelToStore('user', ret, api);

      return ret;
    }, 'merge');

    this.messages = new InMemorySparseMap<MessagesKey, MessageCollection>((key: MessagesKey, api: Api) => {
      return api.channels.history(key).map(({ messages }: { messages: Array<Message> }) => {
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
  }

  saveModelToStore(type: ModelType, value: any, api: Api): void {
    let u;
    switch (type) {
    case 'channel':
      this.database.channels.deferredPut(value);
      u = this.channels.listen(value.id, api, true);
      if (u) u.next(value);
      break;
    case 'user':
      this.database.users.deferredPut(value);
      u = this.users.listen(value.id, api, true);
      if (u) u.next(value);
      break;
    case 'event':
      this.events.listen(value.id, api).next(value);
      break;
    }
  }

  setKeyInStore(key: string, value: any): void {
    this.database.keyValues.deferredPut({ Key: key, Value: JSON.stringify(value) });
    let u = this.users.listen(key, null, true);
    if (u) u.next(value);
  }
}