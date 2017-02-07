export interface SparseMap<K, V> {
  readonly size: number;

  get(key: K): Promise<V>;
  getMany(keys: Array<K>): Promise<Map<K, V>>;
  getCachedKeys(): Array<K>;
};

