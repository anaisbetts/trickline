import { Observable } from 'rxjs/Observable';
import { SparseMap, InMemorySparseMap } from './sparse-map';
import { Api, createApi, infoApiForChannel, userForId, fetchSingleMessage, timestampToPage } from './models/slack-api';
import { ChannelBase, Message, User, MsgTimestamp } from './models/api-shapes';
import { fetchMessagePageForChannel } from './store-network';
import { EventType } from './models/event-type';
import { ArrayUpdatable } from './updatable';
import { SortedArray } from './sorted-array';

import 'rxjs/add/observable/dom/webSocket';
import './standard-operators';
import './custom-operators';

const d = require('debug')('trickline:store');

export interface Range<T> {
  oldest: T;
  latest: T;
}

export interface MessageKey {
  channel: string;
  timestamp: MsgTimestamp;
}

export interface MessagePageKey {
  channel: string;
  page: number;
}

export type MessageCollection = Range<string> & {
  messages: Array<Message>;
  api: Api;
};

export type ModelType =
  'user' | 'channel' | 'event' | 'message';

export interface Store {
  api: Api[];
  events: SparseMap<EventType, Message>;
  joinedChannels: ArrayUpdatable<string>;

  channels: SparseMap<string, ChannelBase>;
  users: SparseMap<string, User>;
  keyValueStore: SparseMap<string, any>;
  messages: SparseMap<MessageKey, Message>;
  messagePages: SparseMap<MessagePageKey, SortedArray<MessageKey>>;

  saveModelToStore(type: ModelType, value: any, api: Api): void;
  setKeyInStore(key: string, value: any): void;
}

const modelTypeToSparseMap = {
  'channel': 'channels',
  'user': 'users',
  'message': 'messages',
};

export function messageCompare(a: Message, b: Message) {
  if (a.ts === b.ts) return 0;
  let c = a.ts - b.ts;
  return (c > 0) ? 1 : -1;
}

export function messageKeyCompare(a: MessageKey, b: MessageKey) {
  if (a.timestamp === b.timestamp) return 0;
  let c = a.timestamp - b.timestamp;
  return (c > 0) ? 1 : -1;
}

export function messageKeyToString(key: MessageKey) {
  return `${key.channel}.${key.timestamp}`;
}

export class NaiveStore implements Store {
  api: Api[];

  joinedChannels: ArrayUpdatable<string>;
  channels: SparseMap<string, ChannelBase>;
  users: SparseMap<string, User>;
  messages: SparseMap<MessageKey, Message>;
  messagePages: SparseMap<MessagePageKey, SortedArray<MessageKey>>;
  events: SparseMap<EventType, Message>;
  keyValueStore: SparseMap<string, any>;

  constructor(tokenList: string[] = []) {
    this.api = tokenList.map(x => createApi(x));

    this.channels = new InMemorySparseMap((id: string, api: Api) => {
      return infoApiForChannel(id, api).toPromise();
    }, 'merge');

    this.users = new InMemorySparseMap<string, User>(
      (user: string, api: Api) => userForId(user, api).toPromise(),
      'merge');

    this.messages = new InMemorySparseMap<MessageKey, Message>(
      (key: MessageKey, api) => fetchSingleMessage(key.channel, key.timestamp, api).toPromise(), 'merge');

    this.messagePages = new InMemorySparseMap<MessagePageKey, SortedArray<MessageKey>>(async (k, api) => {
      let result = await fetchMessagePageForChannel(this, k.channel, k.page, api);
      return new SortedArray({ unique: true, compare: messageKeyCompare }, result);
    }, 'array');

    this.events = new InMemorySparseMap<EventType, Message>();
    this.joinedChannels = new ArrayUpdatable<string>();
    this.keyValueStore = new InMemorySparseMap<string, any>(() => Observable.of(undefined));
  }

  saveModelToStore(type: ModelType, value: any, api: Api): void {
    if (type === 'message') {
      d(`Saving ${value.ts} to store!`);
      this.messages.listen({ channel: value.channel, timestamp: value.ts })!.next(value);

      let msg = value as Message;
      let page = this.messagePages.listen({ channel: msg.channel, page: timestampToPage(msg.ts) }, msg.api, true);
      if (!page || !page.value) return;

      page.value.insertOne({ channel: msg.channel, timestamp: msg.ts });
      Platform.performMicrotaskCheckpoint();
    } else {
      d(`Saving ${value.id} to store!`);
      this[modelTypeToSparseMap[type]].listen(value.id, api).next(value);
    }
  }

  setKeyInStore(key: string, value: any): void {
    this.keyValueStore.listen(key).next(value);
  }
}