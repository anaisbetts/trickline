import { Subscription } from 'rxjs/Subscription';

export type Pair<K, V> = { Key: K, Value: V };

export function captureStack(): string {
  try { throw new Error(); } catch (e) { return e.stack; }
}

export function detectTestRunner() {
  let stack = captureStack();
  return !!stack.split('\n').find(x => !!x.match(/[\\\/](enzyme|mocha)[\\\/]/i));
}

export type deferredAction = (() => Promise<void> | void);

let hasFocus: boolean | undefined;
let isInTestRunner: boolean;
let currentRafToken: number | undefined;
let deferredItemQueue: Array<{ action: deferredAction, cancelled: boolean }> = [];

function dispatchDeferredActions() {
  let start = performance.now();
  try {
    while(deferredItemQueue.length > 0) {
      let item = deferredItemQueue.shift()!;
      if (item.cancelled) continue;

      item.action();
      if (performance.now() - start > 250) break;
    }
  } finally {
    hasFocus = undefined;
    currentRafToken = undefined;
  }

  if (deferredItemQueue.length > 0) createDeferredAction();
}

function createDeferredAction() {
  if (currentRafToken) return;
  if (hasFocus === undefined) hasFocus = document.hasFocus();

  if (isInTestRunner) {
    currentRafToken = 1;
    dispatchDeferredActions();
    return;
  }

  currentRafToken = hasFocus ?
    requestAnimationFrame(dispatchDeferredActions) :
    window.setTimeout(dispatchDeferredActions, 20);
}

export function queueDeferredAction(action: deferredAction): Subscription {
  // NB: We have to check this here because we use the call stack to determine this
  if (isInTestRunner === undefined) {
    isInTestRunner = detectTestRunner();
  }

  let toAdd = { action, cancelled: false };
  deferredItemQueue.push(toAdd);

  createDeferredAction();
  return new Subscription(() => toAdd.cancelled = true);
}