import { Observable } from 'rxjs/Observable';

import { InMemorySparseMap, SparseMap } from './sparse-map';
import { Updatable } from './updatable';
import { Api, createApi } from './models/api-call';
import { Channel, ChannelBase, Group, DirectMessage, UsersCounts, User } from './models/api-shapes';
import { asyncMap } from './promise-extras';

import './standard-operators';

export type ChannelList = Array<Updatable<ChannelBase>>;

export class Store {
  api: Api[];

  channels: SparseMap<string, ChannelBase>;
  users: SparseMap<string, User>;
  joinedChannels: Updatable<ChannelList>;

  constructor(tokenList: string[] = []) {
    this.api = tokenList.map(x => createApi(x));

    this.channels = new InMemorySparseMap<string, ChannelBase>();
    this.users = new InMemorySparseMap<string, User>();

/*
    this.users = new InMemorySparseMap<Pair<string, any>, User>((user) => {
      return this.api.users.info({ user }).map(x => x.user);
    });
*/

    this.joinedChannels = new Updatable<ChannelList>(() => Observable.of([]));
  }

  async fetchInitialChannelList(): Promise<void> {
    let results = await asyncMap(this.api, (api) => this.fetchSingleInitialChannelList(api));

    let allJoinedChannels = Array.from(results.values())
      .reduce((acc, x) => acc.concat(x), []);

    this.joinedChannels.next(allJoinedChannels);
  }

  async fetchSingleInitialChannelList(api: Api): Promise<ChannelList> {
    const joinedChannels: ChannelList = [];

    const result: UsersCounts = await api.users.counts({ simple_unreads: true }).toPromise();

    result.channels.forEach((c) => {
      joinedChannels.push(this.makeUpdatableForChannel<Channel>(c, api, 'channels', 'channel'));
    });

    result.groups.forEach((g) => {
      joinedChannels.push(this.makeUpdatableForChannel<Group>(g, api, 'groups', 'group'));
    });

    result.ims.forEach((dm) => {
      joinedChannels.push(this.makeUpdatableForChannel<DirectMessage>(dm, api, 'ims', 'im'));
    });

    return joinedChannels;
  }

  private makeUpdatableForChannel<T extends ChannelBase>(channel: ChannelBase, api: Api, route: string, modelName: string) {
    channel.api = api;
    const updater = new Updatable(() =>
      api[route].info({ channel: channel.id })
        .map((model: any) => model[modelName]) as Observable<T>);

    updater.playOnto(Observable.of(channel));
    this.channels.setDirect(channel.id, updater);
    return updater;
  }
}