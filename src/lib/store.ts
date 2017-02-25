import { Observable } from 'rxjs/Observable';

import { Updatable } from './sparse-map';
import { createApi } from './models/api-call';
import { Channel, Group, DirectMessage, UsersCounts } from './models/api-shapes';

import './standard-operators';

export type ChannelList = Array<Updatable<Channel>>;
export type GroupList = Array<Updatable<Group>>;
export type DirectMessageList = Array<Updatable<DirectMessage>>;

export class Store {
  api: any;
  channels: Updatable<ChannelList>;
  groups: Updatable<GroupList>;
  ims: Updatable<DirectMessageList>;

  constructor(token?: string) {
    this.api = createApi(token);
    this.channels = new Updatable<ChannelList>(() => Observable.of([]));
    this.groups = new Updatable<GroupList>(() => Observable.of([]));
    this.ims = new Updatable<DirectMessageList>(() => Observable.of([]));
  }

  async fetchInitialChannelList(): Promise<void> {
    const channels: ChannelList = [];
    const groups: GroupList = [];
    const ims: DirectMessageList = [];

    const result: UsersCounts = await this.api.users.counts().toPromise();

    result.channels
      .filter((c) => !c.is_archived)
      .sort(this.channelSort)
      .forEach((c) => {
        const updater = new Updatable(() =>
          this.api.channels.info({ channel: c.id })
            .map((x: any) => x.channel) as Observable<Channel>);

        updater.playOnto(Observable.of(c));
        channels.push(updater);
    });

    result.groups.forEach((g) => {
      const updater = new Updatable(() =>
        this.api.groups.info({ channel: g.id })
          .map((x: any) => x.group) as Observable<Group>);

      updater.playOnto(Observable.of(g));
      groups.push(updater);
    });

    result.ims.filter((dm) => !dm.is_open).forEach((dm) => {
      const updater = new Updatable(() =>
        this.api.im.info({ channel: dm.id })
          .map((x: any) => x.im) as Observable<DirectMessage>);

      updater.playOnto(Observable.of(dm));
      ims.push(updater);
    });

    this.channels.next(channels);
    this.groups.next(groups);
    this.ims.next(ims);
  }

  channelSort(a: Channel, b: Channel): number {
    if (a.is_starred && !b.is_starred) return -1;
    else if (b.is_starred && !a.is_starred) return 1;
    return a.name.localeCompare(b.name);
  }
}