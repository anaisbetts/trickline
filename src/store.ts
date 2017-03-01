import { Observable } from 'rxjs/Observable';

import { InMemorySparseMap, SparseMap } from './lib/sparse-map';
import { Updatable } from './lib/updatable';
import { Api, createApi } from './lib/models/api-call';
import { Channel, ChannelBase, Group, DirectMessage, Message, UsersCounts, User } from './lib/models/api-shapes';
import { EventType } from './lib/models/event-type';
import { asyncMap } from './lib/promise-extras';

import './lib/standard-operators';
import 'rxjs/Observable/dom/webSocket';

export type ChannelList = Array<Updatable<ChannelBase>>;

export class Store {
  api: Api[];

  channels: SparseMap<string, ChannelBase>;
  users: SparseMap<string, User>;
  joinedChannels: Updatable<ChannelList>;
  events: SparseMap<EventType, Message>;

  constructor(tokenList: string[] = []) {
    this.api = tokenList.map(x => createApi(x));

    this.channels = new InMemorySparseMap<string, ChannelBase>();
    this.users = new InMemorySparseMap<string, User>((user, api: Api) => {
      return api.users.info({ user }).map(({user}) => {
        user.api = api;
        return user;
      });
    });

    this.joinedChannels = new Updatable<ChannelList>(() => Observable.of([]));

    this.events = new InMemorySparseMap<EventType, Message>();
    this.events.listen('user_change')
      .do(({user}) => console.log(`Updating a user!!! ${JSON.stringify(user)}`))
      .subscribe(({user}) => this.users.listen(user.id).playOnto(Observable.of(user)));

    this.connectToRtm()
      .groupBy(x => x.type)
      .publish().refCount()
      .retry()
      .subscribe(x => this.events.listen(x.key).playOnto(x));
  }

  connectToRtm(): Observable<Message> {
    return Observable.merge(
      ...this.api.map(x => this.createRtmConnection(x))
    );
  }

  async fetchInitialChannelList(): Promise<void> {
    let results = await asyncMap(this.api, (api) => this.fetchSingleInitialChannelList(api));

    let allJoinedChannels = Array.from(results.values())
      .reduce((acc, x) => acc.concat(x), []);

    this.joinedChannels.next(allJoinedChannels);
  }

  private async fetchSingleInitialChannelList(api: Api): Promise<ChannelList> {
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

  private createRtmConnection(api: Api): Observable<Message> {
    return api.rtm.connect()
      .flatMap(({url}) => Observable.webSocket(url))
      .map(msg => { msg.api = api; return msg; });
  }
}