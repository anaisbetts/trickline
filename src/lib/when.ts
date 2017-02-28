import * as LRU from 'lru-cache';
import {Updatable} from './sparse-map';

const proxyCache = LRU(64);

function isObject(o: any): Boolean {
  return o === Object(o);
}

const EMPTY_FN = () => {};
export class SelfDescribingProxyHandler {
  name: string;

  constructor(name: string) {
    this.name = name;
  }

  get(_target: any, name: string) {
    return SelfDescribingProxyHandler.create(`${this.name}.${name}`);
  }

  apply() {
    return this.name;
  }

  static create(name='') {
    let ret = proxyCache.get(name);
    if (ret) return ret;

    ret = new Proxy(EMPTY_FN, new SelfDescribingProxyHandler(name));
    proxyCache.set(name, ret);
    return ret;
  }
}

export function functionToPropertyChain(chain: Function): Array<string> {
  let input = SelfDescribingProxyHandler.create();
  let result: Function = chain(input);

  let ret: string = result();
  return ret.substring(1).split('.');
}

const didntWork = { failed: true };
export function fetchValueForPropertyChain(target: any, chain: Array<string>): { result?: any, failed: boolean } {
  let current = target;
  if (current instanceof Updatable && chain[0] !== 'value') {
    try {
      current = current.value;
    } catch (_e) {
      return didntWork;
    }
  }

  for (let i = 0; i < chain.length; i++) {
    try {
      current = current[chain[i]];
    } catch (_e) {
      return didntWork;
    }

    if (current === undefined) return didntWork;

    // NB: Current is a non-object; if we're at the end of the chain, we
    // should return it, if we're not, we're in an error state and should
    // bail
    if (!isObject(current))  {
      return (i === chain.length - 1) ? { result: current, failed: false} : didntWork;
    }

    if (current instanceof Updatable && chain[i + 1] !== 'value') {
      try {
        current = current.value;
      } catch (_e) {
        return didntWork;
      }
    }
  }

  return { result: current, failed: false };
}

export function getValue<T, TRet>(target: T, accessor: ((x: T) => TRet)): { result?: TRet, failed: boolean } {
  const propChain = functionToPropertyChain(accessor);
  return fetchValueForPropertyChain(target, propChain);
}