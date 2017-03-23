import { Api } from '../../src/lib/models/slack-api';
import { ArrayUpdatable } from '../../src/lib/updatable';
import { ChannelBase, Message, User } from '../../src/lib/models/api-shapes';
import { EventType } from '../../src/lib/models/event-type';
import { SparseMap, InMemorySparseMap } from '../../src/lib/sparse-map';
import { Store, ModelType, MessagesKey, MessageCollection } from '../../src/lib/store';

export interface MockStoreSeedData {
  channels?: { [key: string]: ChannelBase };
  users?: { [key: string]: User };
  joinedChannels?: Array<string>;
}

export class MockStore implements Store {
  api: Api[];

  channels: SparseMap<string, ChannelBase>;
  users: SparseMap<string, User>;
  messages: SparseMap<MessagesKey, MessageCollection>;
  events: SparseMap<EventType, Message>;
  joinedChannels: ArrayUpdatable<string>;
  keyValueStore: SparseMap<string, any>;

  constructor(seedData: MockStoreSeedData) {
    this.channels = new InMemorySparseMap((id: string) => {
      return seedData.channels ?
        Promise.resolve(seedData.channels[id]) :
        Promise.reject(`No channel for ${id}`);
    });

    this.users = new InMemorySparseMap((id: string) => {
      return seedData.users ?
        Promise.resolve(seedData.users[id]) :
        Promise.reject(`No user for ${id}`);
    });

    this.joinedChannels = new ArrayUpdatable<string>(() => {
      return seedData.joinedChannels ?
        Promise.resolve(seedData.joinedChannels) :
        Promise.reject(`Missing joined channels`);
    });
  }

  saveModelToStore(_type: ModelType, _value: any, _api: Api): void { } // tslint:disable-line
  setKeyInStore(_key: string, _value: any): void { } // tslint:disable-line
}