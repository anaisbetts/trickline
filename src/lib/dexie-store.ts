import { AsyncSubject } from 'rxjs/AsyncSubject';

import Dexie from 'dexie';

import { Store, MessagesKey, MessageCollection, ModelType } from './store';
import { Api, createApi, infoApiForChannel } from './models/slack-api';
import { ArrayUpdatable } from './updatable';
import { SparseMap, InMemorySparseMap } from './sparse-map';
import { ChannelBase, User, Message } from './models/api-shapes';
import { EventType } from './models/event-type';
import { Pair } from './utils';
import { asyncMap } from './promise-extras';

const VERSION = 1;

export interface DeferredPutItem<T> {
  item: T;
  completion: AsyncSubject<void>;
}

export interface DeferredGetItem<T, TKey> {
  key: TKey;
  completion: AsyncSubject<T>;
}

declare module 'dexie' {
  module Dexie {
    interface Table<T, Key> {
      deferredPut: ((item: T) => Promise<void>);
      deferredGet: ((key: Key, database: Dexie) => Promise<T>);
      idlePutHandle: number | null;
      idleGetHandle: number | null;
      deferredPuts: DeferredPutItem<T>[];
      deferredGets: DeferredGetItem<T, Key>[];
    }
  }
}

function deferredPut<T, Key>(this: Dexie.Table<T, Key>, item: T): Promise<void> {
  let newItem = { item, completion: new AsyncSubject<void>() };

  let createIdle = () => window.requestIdleCallback(deadline => {
    while (deadline.timeRemaining() > 5/*ms*/) {
      // TODO: This would be cooler if it recognized duplicate IDs and threw out the older
      // one (i.e. you update channel.topic and channel.name in the same batch, so we really
      // only need to write the newer one)
      let itemsToAdd = this.deferredPuts;
      this.deferredPuts = itemsToAdd.splice(128);

      let toPut = itemsToAdd.map(x => {
        let ret = Object.assign({}, x.item);
        if (ret.api) {
          ret.token = ret.api.token();
          ret.api = null;
        }

        return ret;
      });

      // XXX: This is unbounded concurrency!
      this.bulkPut(toPut);
      itemsToAdd.forEach(x => { x.completion.next(undefined); x.completion.complete(); });
    }

    if (this.deferredPuts.length) {
      this.idlePutHandle = createIdle();
    } else {
      this.idlePutHandle = null;
    }
  });

  this.deferredPuts = this.deferredPuts || [];
  this.deferredPuts.push(newItem);
  if (!this.idlePutHandle) {
    this.idlePutHandle = createIdle();
  }

  return newItem.completion.toPromise();
}

function deferredGet<T, Key>(this: Dexie.Table<T, Key>, key: Key, database: Dexie): Promise<T> {
  let newItem = { key, completion: new AsyncSubject<T>() };

  let createIdle = () => window.requestAnimationFrame(async () => {
    let itemsToGet = this.deferredGets;
    this.deferredGets = [];

    try {
      await database.transaction('r', this, () => {
        return asyncMap(itemsToGet, (x) => {
          return this.get(x.key).then(result => {
            x.completion.next(result!);
            x.completion.complete();
          }, (e: Error) => x.completion.error(e));
        }, 32);
      });
    } finally {
      this.idleGetHandle = null;
    }
  });

  this.deferredGets = this.deferredGets || [];
  this.deferredGets.push(newItem);

  if (!this.idleGetHandle) {
    this.idleGetHandle = createIdle();
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
    Object.getPrototypeOf(this.users).deferredGet = deferredGet;
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
      let ret = await this.database.channels.deferredGet(id, this.database);
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
      let ret = await this.database.users.deferredGet(id, this.database);
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

    this.keyValueStore = new InMemorySparseMap<string, any>(async (key: string) => {
      let ret = await this.database.keyValues.deferredGet(key, this.database);
      return ret ? JSON.parse(ret.Value) : null;
    });

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