import { SparseMap, SparseMapMixins } from './sparse-map';
import { Updatable } from './updatable';
import { User } from './models/api-shapes';

import Dexie from 'dexie';
import * as LRU from 'lru-cache';

import { Observable } from 'rxjs/Observable';
import { MergeStrategy } from './updatable';

const VERSION = 1;

export class DexieDataModel extends Dexie  {
  users: Dexie.Table<User, string>;
  usersSchema: string;

  constructor() {
    super('SparseMap');

    this.usersSchema = 'id,name,real_name,color,profile';
    this.version(VERSION).stores({
      users: this.usersSchema
    });
  }
}

let dbConnection: DexieDataModel | null = null;

class DexieSparseMap<V> implements SparseMap<string, V> {
  private tableName: string;
  private dbConnection: DexieDataModel;
  private factory: ((key: string, hint?: any) => Observable<V>) | undefined;
  private strategy: MergeStrategy;
  private inMemoryCache: LRU.Cache<Updatable<V>>;
  private keysToSave: string[];

  constructor(
      factory: ((key: string, hint?: any) => Observable<V>) | undefined = undefined,
      strategy: MergeStrategy = 'overwrite',
      tableName: string) {

    if (!dbConnection) {
      dbConnection = new DexieDataModel();
      dbConnection.open();
    }

    this.dbConnection = dbConnection;

    this.tableName = tableName;
    this.keysToSave = (dbConnection[`${tableName}Schema`] as string).split(',');
    this.factory = factory;
    this.strategy = strategy;
    this.inMemoryCache = LRU<Updatable<V>>({
      max: 256,
      dispose: (k, v) => {
        this.save(k, v.value);
        console.log('Saving to db because dispose!');

        v.playOnto(Observable.empty());
        v.unsubscribe();
      }
    });
  }

  listen(key: string, hint?: any): Updatable<V> {
    let ret = this.inMemoryCache.get(key);
    if (ret) return ret;

    if (this.factory) {
      let fact = this.factory.bind(this);
      ret = new Updatable<V>(() => fact(key, hint), this.strategy);
    } else {
      ret = new Updatable<V>(undefined, this.strategy);
    }

    let table: Dexie.Table<V, string> = this.dbConnection[this.tableName];
    ret.playOnto(Observable.fromPromise(table.get(key as string)).catch((e) => {
      console.log(`Failed to get ${key}! ${e.message}`);
      return Observable.empty();
    }));
    ret.subscribe(x => {
      console.log('Saving to db because changed!');
      this.save(key, x);
    });

    this.inMemoryCache.set(key, ret);
    return ret;
  }

  listenAll(): Map<string, Updatable<V>> {
    return this.inMemoryCache.keys().reduce((acc, x) => {
      acc[x] = this.inMemoryCache.get(x);
      return acc;
    }, new Map());
  }

  setDirect(key: string, value: Updatable<V>): Promise<void> {
    this.inMemoryCache.del(key);
    this.inMemoryCache.set(key, value);

    value.subscribe(x => {
      console.log('Saving to db because changed!');
      this.save(key, x);
    });

    return Promise.resolve();
  }

  setLazy(key: string, value: Observable<V>): Promise<void> {
    this.listen(key).playOnto(value);
    return Promise.resolve();
  }

  invalidate(key: string): Promise<void> {
    this.inMemoryCache.del(key);
    return Promise.resolve();
  }

  private save(key: string, value: V): Promise<void> {
    let table: Dexie.Table<V, string> = this.dbConnection[this.tableName];
    let toSave = this.keysToSave.reduce((acc, x) => {
      acc[x] = value[x];
      return acc;
    }, {});

    return table.add(toSave as V);
  }
}

DexieSparseMap.prototype = Object.assign(DexieSparseMap.prototype, SparseMapMixins);

export { DexieSparseMap };