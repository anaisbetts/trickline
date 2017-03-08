import { SparseMap } from './sparse-map';
import { Updatable } from './updatable';
import { Api } from './models/slack-api';
import { ChannelBase, Message, User } from './models/api-shapes';
import { EventType } from './models/event-type';

import './lib/standard-operators';
import 'rxjs/add/observable/dom/webSocket';

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