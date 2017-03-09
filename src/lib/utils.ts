export type Pair<K, V> = { Key: K, Value: V };

export function captureStack() {
  try { throw new Error(); } catch (e) { return e.stack; }
}