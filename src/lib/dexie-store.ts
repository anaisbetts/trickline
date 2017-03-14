import { Observable } from 'rxjs/Observable';
import { AsyncSubject } from 'rxjs/AsyncSubject';

import Dexie from 'dexie';

import { Store, MessagesKey, MessageCollection, StoreAsWritable } from './store';
import { Api, createApi, infoApiForChannel } from './models/slack-api';
import { ArrayUpdatable } from './updatable';
import { SparseMap, InMemorySparseMap, LRUSparseMap } from './sparse-map';
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
    }
  }
}

function deferredPut<T, Key>(this: Dexie.Table<T, Key>, item: T): Promise<void> {
  let newItem = { item, completion: new AsyncSubject<void>() };

  let createIdle = () => window.requestIdleCallback(deadline => {
    while (deadline.timeRemaining() > 5/*ms*/) {
      let itemsToAdd = this.deferredItems;
      this.deferredItems = itemsToAdd.splice(128);

      this.bulkPut(itemsToAdd.map(x => Object.assign({}, x.item, { api: null })));
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

class DexieWritableStore implements StoreAsWritable {
  channels: SparseMap<string, ChannelBase>;
  users: SparseMap<string, User>;
  messages: SparseMap<MessagesKey, MessageCollection>;
  keyValueStore: SparseMap<string, any>;

  private database: DataModel;

  constructor(database: DataModel) {
    this.database = database;

    this.channels = new LRUSparseMap<ChannelBase>((k) => this.database.channels.get(k), 'merge', { max: 256 });
    this.users = new LRUSparseMap<User>((k) => this.database.users.get(k), 'merge', { max: 256 });

    this.keyValueStore = new LRUSparseMap<string>((k) => {
      return this.database.keyValues.get(k).then(x => x ? JSON.parse(x.Value) : null);
    }, 'overwrite', { max: 64 });

    this.channels.created.subscribe(kvp => {
      kvp.Value.skip(1)
        .flatMap(v => this.database.channels.deferredPut(v))
        .subscribe();
    });

    this.users.created.subscribe(kvp => {
      kvp.Value.skip(1)
        .flatMap(v => this.database.users.deferredPut(v))
        .subscribe();
    });

    this.keyValueStore.created.subscribe(kvp => {
      kvp.Value.skip(1)
        .flatMap(v => this.database.keyValues.deferredPut({Key: kvp.Key, Value: JSON.stringify(v)}))
        .subscribe();
    });

    this.keyValueStore.evicted.subscribe(x => x.Value.unsubscribe());
    this.messages.evicted.subscribe(x => x.Value.unsubscribe());
    this.users.evicted.subscribe(x => x.Value.unsubscribe());
    this.channels.evicted.subscribe(x => x.Value.unsubscribe());
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

  write: StoreAsWritable;
  private database: DataModel;

  constructor(tokenList: string[] = []) {
    this.api = tokenList.map(x => createApi(x));

    this.database = new DataModel();
    this.database.open();
    this.write = new DexieWritableStore(this.database);

    this.channels = new InMemorySparseMap((id: string, api: Api) => {
      return infoApiForChannel(id, api).toPromise();
    }, 'merge');

    this.users = new InMemorySparseMap<string, User>((user: string, api: Api) => {
      return api.users.info({user}).map((x: any) => x.user! as User).toPromise();
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

    this.channels.created
      .flatMap(async x => {
        let dbVal = await this.write.channels.get(x.Key);
        if (dbVal) x.Value.next(dbVal);
      })
      .subscribe();

    this.users.created
      .flatMap(async x => {
        let dbVal = await this.write.users.get(x.Key);
        if (dbVal) x.Value.next(dbVal);
      })
      .subscribe();

    this.events = new InMemorySparseMap<EventType, Message>();
    this.joinedChannels = new ArrayUpdatable<string>();
  }
}