import { RecursiveProxyHandler } from 'electron-remote';

import { Store } from '../../src/lib/store';
import { Updatable } from '../../src/lib/updatable';
import { ChannelBase, User } from '../../src/lib/models/api-shapes';

export function createMockStore(seedData: any): Store {
  return RecursiveProxyHandler.create('mockStore', (names: Array<string>, params: Array<any>) => {
    const id = params[0];
    const model = seedData[id];

    switch (names[1]) {
      case 'channels':
        return new Updatable<ChannelBase>(() => Promise.resolve(model));
      case 'users':
        return new Updatable<User>(() => Promise.resolve(model));
      default:
        throw new Error(`${names[1]} not yet implemented in MockStore`);
    }
  });
}