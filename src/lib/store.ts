import { SparseMap, InMemorySparseMap } from './sparse-map';
import { Api, createApi, infoApiForChannel } from './models/slack-api';
import { ChannelBase, Message, User } from './models/api-shapes';
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

export interface StoreAsWritable {
  channels: SparseMap<string, ChannelBase>;
  users: SparseMap<string, User>;
  messages: SparseMap<MessagesKey, MessageCollection>;
  keyValueStore: SparseMap<string, any>;
}

export interface Store extends StoreAsWritable {
  api: Api[];
  events: SparseMap<EventType, Message>;
  joinedChannels: ArrayUpdatable<string>;

  readonly write: StoreAsWritable;
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
  }

  get write() { return this; }
}