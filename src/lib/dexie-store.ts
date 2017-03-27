import { Store, ModelType, MessagePageKey, MessageKey, messageCompare, messageKeyToString } from './store';
import { Api, createApi, infoApiForChannel, fetchSingleMessage, pageToTimestamp } from './models/slack-api';
import { ArrayUpdatable } from './updatable';
import { SparseMap, InMemorySparseMap, LRUSparseMap } from './sparse-map';
import { ChannelBase, User, Message } from './models/api-shapes';
import { EventType } from './models/event-type';
import { SortedArray } from './sorted-array';
import { fetchMessagePageForChannel } from './store-network';
import { DataModel } from './dexie-data-model';

import * as LRU from 'lru-cache';

const d = require('debug')('trickline:dexie-store');

export class DexieStore implements Store {
  api: Api[];

  joinedChannels: ArrayUpdatable<string>;
  channels: SparseMap<string, ChannelBase>;
  users: SparseMap<string, User>;
  messages: SparseMap<MessageKey, Message>;
  messagePages: SparseMap<MessagePageKey, SortedArray<MessageKey>>;
  events: SparseMap<EventType, Message>;
  keyValueStore: SparseMap<string, any>;

  private messageCache: LRU.Cache<Message>;
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
      d(`Factory'ing channel ${id}!`);
      let ret = await this.database.channels.deferredGet(id, this.database);
      if (ret) {
        if (ret.token) {
          ret.api = this.apiTokenMap.get(ret.token);
          delete ret.token;
        }

        return ret;
      }

      let info = await (infoApiForChannel(id, api).toPromise());
      info!.api = api;
      this.saveModelToStore('channel', info, api);
      return info;
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

    this.messageCache = LRU<Message>({ max: 256 });

    this.messages = new InMemorySparseMap<MessageKey, Message>(async (key: MessageKey, api) => {
      // NB: Messages should always be filled in before-hand via messagePages factory fn
      // calling saveModelToStore with all the messages that it found for that page. If that's
      // not happening, we are Doing It Wrong
      let k = messageKeyToString(key);
      let ret = this.messageCache.get(k);
      if (ret) {
        return ret;
      }

      ret = await this.database.messages.deferredGet(key, this.database);
      if (ret) {
        this.messageCache.set(k, ret);
        return ret;
      }

      try {
        ret = await fetchSingleMessage(key.channel, key.timestamp, api).toPromise();
      } catch (e) {
        console.error(`Failed to get message! ${e.message}`);
      }
      if (ret) {
        this.saveModelToStore('message', ret, api);
      }

      return ret;
    }, 'merge');

    this.messagePages = new InMemorySparseMap<MessagePageKey, SortedArray<MessageKey>>(async (k, api) => {
      let range = [
        pageToTimestamp(k.page),
        pageToTimestamp(k.page + 1)
      ];

      let dbItems = await this.database.messages
        .where('ts').inAnyRange([range])
        .filter(x => x.channel === k.channel)
        .toArray();

      let result;
      if (dbItems) {
        result = dbItems.map(x => {
          if (x.token) {
            x.api = this.apiTokenMap.get(x.api);
            delete x.token;
          }

          let key = { channel: x.channel, timestamp: x.ts };
          this.messageCache.set(messageKeyToString(key), x);
          return key;
        });
      }

      if (!result) result = await fetchMessagePageForChannel(this, k.channel, k.page, api);
      return new SortedArray({ unique: true, compare: messageCompare }, result);
    }, 'array');

    this.keyValueStore = new InMemorySparseMap<string, any>(async (key: string) => {
      let ret = await this.database.keyValues.deferredGet(key, this.database);
      return ret ? JSON.parse(ret.Value) : null;
    });

    this.events = new InMemorySparseMap<EventType, Message>();
    this.joinedChannels = new ArrayUpdatable<string>();
  }

  saveModelToStore(type: ModelType, value: any, api: Api): void {
    let u;
    let key: MessageKey;
    let m: Message;

    switch (type) {
    case 'channel':
      this.database.channels.deferredPut(value, value.id);
      u = this.channels.listen(value.id, api, true);
      if (u) u.next(value);
      break;
    case 'message':
      m = value as Message;
      key = { channel: m.channel, timestamp: m.ts };
      this.database.messages.deferredPut(value, key);
      this.messageCache.set(messageKeyToString(key), m);

      u = this.messages.listen(key, null, true);
      if (u) u.next(value);
      break;
    case 'user':
      this.database.users.deferredPut(value, value.id);
      u = this.users.listen(value.id, api, true);
      if (u) u.next(value);
      break;
    case 'event':
      this.events.listen(value.id, api)!.next(value);
      break;
    }
  }

  setKeyInStore(key: string, value: any): void {
    this.database.keyValues.deferredPut({ Key: key, Value: JSON.stringify(value) }, key);
    let u = this.users.listen(key, null, true);
    if (u) u.next(value);
  }
}