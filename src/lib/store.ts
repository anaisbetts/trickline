import { Observable } from 'rxjs/Observable';

import { InMemorySparseMap, SparseMap } from './sparse-map';
import { Updatable } from './updatable';
import { createApi, ChannelResponse, UserResponse } from './models/api-call';
import { Channel, ChannelBase, Group, DirectMessage, UsersCounts } from './models/api-shapes';

import './standard-operators';

export type ChannelList = Array<Updatable<ChannelBase>>;

export class Store {
  api: any;
  channels: SparseMap<string, ChannelResponse>;
  users: SparseMap<string, UserResponse>;
  joinedChannels: Updatable<ChannelList>;

  constructor(token?: string) {
    this.api = createApi(token);
    this.channels = new InMemorySparseMap<string, ChannelBase>((channel) => {
      return this.api.channels.info({ channel });
    });
    this.users = new InMemorySparseMap<string, UserResponse>((user) => {
      return this.api.users.info({ user });
    });
    this.joinedChannels = new Updatable<ChannelList>(() => Observable.of([]));
  }

  async fetchInitialChannelList(): Promise<void> {
    const joinedChannels: ChannelList = [];

    const result: UsersCounts = await this.api.users.counts({ simple_unreads: true }).toPromise();

    result.channels.forEach((c) => {
      joinedChannels.push(this.makeUpdatableForChannel<Channel>(c, this.api.channels, 'channel'));
    });

    result.groups.forEach((g) => {
      joinedChannels.push(this.makeUpdatableForChannel<Group>(g, this.api.groups, 'group'));
    });

    result.ims.forEach((dm) => {
      joinedChannels.push(this.makeUpdatableForChannel<DirectMessage>(dm, this.api.ims, 'im'));
    });

    this.joinedChannels.next(joinedChannels);
  }

  private makeUpdatableForChannel<T extends ChannelBase>(channel: ChannelBase, apiRoute: any, modelName: string) {
    const updater = new Updatable(() =>
      apiRoute.info({ channel: channel.id })
        .map((model: any) => model[modelName]) as Observable<T>);

    updater.playOnto(Observable.of(channel));
    this.channels.setDirect(channel.id, updater);
    return updater;
  }
}