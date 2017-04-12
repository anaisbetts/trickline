export type Pair<K, V> = { Key: K, Value: V };

export function captureStack(): string {
  try { throw new Error(); } catch (e) { return e.stack; }
}

export function detectTestRunner() {
  let stack = captureStack();
  return stack.split('\n').find(x => !!x.match(/[\\\/](enzyme|mocha)[\\\/]/i)) !== null;
}