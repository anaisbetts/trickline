import { Observable } from 'rxjs/Observable';

import { Updatable } from './sparse-map';
import { createApi } from './models/api-call';
import { Channel, ChannelBase, Group, DirectMessage, UsersCounts } from './models/api-shapes';

import './standard-operators';

export type ChannelList = Array<Updatable<ChannelBase>>;

export class Store {
  api: any;
  channels: Updatable<ChannelList>;

  constructor(token?: string) {
    this.api = createApi(token);
    this.channels = new Updatable<ChannelList>(() => Observable.of([]));
  }

  async fetchInitialChannelList(): Promise<void> {
    const channels: ChannelList = [];

    const result: UsersCounts = await this.api.users.counts({ simple_unreads: true }).toPromise();

    result.channels.forEach((c) => {
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
      channels.push(updater);
    });

    result.ims.forEach((dm) => {
      const updater = new Updatable(() =>
        this.api.im.info({ channel: dm.id })
          .map((x: any) => x.im) as Observable<DirectMessage>);

      updater.playOnto(Observable.of(dm));
      channels.push(updater);
    });

    this.channels.next(channels);
  }
}