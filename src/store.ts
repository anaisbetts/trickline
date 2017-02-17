import { Observable } from 'rxjs/Observable';
import { InMemorySparseMap, SparseMap, Updatable } from './sparse-map';

import { createApi } from './models/api-call';
import { ChannelBase, UsersCounts } from './models/api-shapes';

import './standard-operators';

export class Store {
  channels: SparseMap<string, ChannelBase>;
  joinedChannels: Updatable<Array<Updatable<ChannelBase>>>;
  api: any;

  constructor(token?: string) {
    this.channels = new InMemorySparseMap<string, ChannelBase>();
    this.joinedChannels = new Updatable<Array<Updatable<ChannelBase>>>(() => Observable.of([]));
    this.api = createApi(token);
  }

  async fetchInitialChannelList(): Promise<void> {
    const joinedChannels: Array<Updatable<ChannelBase>> = [];
    let result: UsersCounts = await this.api.users.counts().toPromise();

    console.log(result);
    result.channels.forEach(c => {
      let updater = new Updatable(() =>
        this.api.channels.info({channel: c.id}).map(x => x.channel) as Observable<ChannelBase>);
      updater.playOnto(Observable.of(c));

      joinedChannels.push(updater);
      this.channels.setDirect(c.id, updater);
    });

    result.groups.forEach(c => {
      let updater = new Updatable(() =>
        this.api.groups.info({channel: c.id}).map(x => x.group) as Observable<ChannelBase>);
      updater.playOnto(Observable.of(c));

      joinedChannels.push(updater);
      this.channels.setDirect(c.id, updater);
    });

    result.ims.forEach(c => {
      let updater = new Updatable(() => 
        this.api.im.info({channel: c.id}).map(x => x.im) as Observable<ChannelBase>);
      updater.playOnto(Observable.of(c));

      joinedChannels.push(updater);
      this.channels.setDirect(c.id, updater);
    });

    console.log(`Next'ing channels! ${joinedChannels.length}`);
    this.joinedChannels.next(joinedChannels);
  }
}