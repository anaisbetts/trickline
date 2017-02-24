import { Observable } from 'rxjs/Observable';

import { Updatable } from './sparse-map';
import { createApi } from './models/api-call';
import { ChannelBase, Channel, UsersCounts } from './models/api-shapes';

import './standard-operators';

export type ChannelList = Array<Updatable<ChannelBase>>;

export class Store {
  api: any;
  channels: Updatable<ChannelList>;
  groups: Updatable<ChannelList>;
  ims: Updatable<ChannelList>;

  constructor(token?: string) {
    this.api = createApi(token);
    this.channels = new Updatable<ChannelList>(() => Observable.of([]));
    this.groups = new Updatable<ChannelList>(() => Observable.of([]));
    this.ims = new Updatable<ChannelList>(() => Observable.of([]));
  }

  async fetchInitialChannelList(): Promise<void> {
    const channels: ChannelList = [];
    const groups: ChannelList = [];
    const ims: ChannelList = [];

    const result: UsersCounts = await this.api.users.counts().toPromise();

    result.channels
      .filter((c) => !c.is_archived)
      .sort(this.channelSort)
      .forEach((c) => {
        const updater = new Updatable(() =>
          this.api.channels.info({ channel: c.id })
            .map((x: any) => x.channel) as Observable<ChannelBase>);

        updater.playOnto(Observable.of(c));
        channels.push(updater);
    });

    result.groups.forEach((g) => {
      const updater = new Updatable(() =>
        this.api.groups.info({ channel: g.id })
          .map((x: any) => x.group) as Observable<ChannelBase>);

      updater.playOnto(Observable.of(g));
      groups.push(updater);
    });

    result.ims.filter((dm) => !dm.is_open).forEach((dm) => {
      const updater = new Updatable(() =>
        this.api.im.info({ channel: dm.id })
          .map((x: any) => x.im) as Observable<ChannelBase>);

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