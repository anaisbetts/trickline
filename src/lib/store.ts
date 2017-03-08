import { SparseMap, InMemorySparseMap } from './sparse-map';
import { Updatable } from './updatable';
import { Api, createApi, infoApiForChannel } from './models/slack-api';
import { ChannelBase, Message, User, UsersCounts } from './models/api-shapes';
import { EventType } from './models/event-type';
import { asyncMap } from './promise-extras';

import './standard-operators';
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

export class NaiveStore implements Store {
  api: Api[];

  channels: SparseMap<string, ChannelBase>;
  users: SparseMap<string, User>;
  events: SparseMap<EventType, Message>;
  joinedChannels: Updatable<ChannelList>;
  keyValueStore: SparseMap<string, any>;

  constructor(tokenList: string[] = []) {
    this.api = tokenList.map(x => createApi(x));

    this.channels = new InMemorySparseMap((id: string, api: Api) => infoApiForChannel(id, api).toPromise(), 'merge');
    this.users = new InMemorySparseMap((user: string, api: Api) => api.users.info({user}).map(x => x.user).toPromise(), 'merge');
    this.events = new InMemorySparseMap<EventType, Message>();
    this.joinedChannels = new Updatable<ChannelList>();
    this.keyValueStore = new InMemorySparseMap<string, any>();
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
}