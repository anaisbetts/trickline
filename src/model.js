import {Subscription, Subject } from 'rxjs/Rx';

const d = require('debug')('trickline:model');

function getDescriptorForProperty(target, name, descriptor) {
  let val = undefined;
  
  return Object.assign({
    get: () => val,
    set: function(newVal) {
      if (val === newVal) return;
      
      this.changing.next(name);
      val = newVal;
      this.changed.next(name);
    }
  }, descriptor);
}

export function notify(...properties) {
  return (target) => {
    for (let prop of properties) {
      let descriptor = getDescriptorForProperty(
        target.prototype, prop, { configurable: true, enumerable: true });
      Object.defineProperty(target.prototype, prop, descriptor);
    }
  };
}

export function asProperty(target, key, descriptor) {
  let observableGenerator = descriptor.value;
  let hasSubscribed = false;
  let latestValue = undefined;
      
  return {
    configurable: descriptor.configurable || true,
    enumerable: descriptor.enumerable || true,
    get: function() {
      if (hasSubscribed) return latestValue;
      
      this.innerDisp.add(observableGenerator.apply(this)
        .filter((x) => latestValue !== x)
        .subscribe(
          (x) => {
            this.changing.next(key);
            latestValue = x;
            this.changed.next(key);
          }, (e) => { throw e; }, () => {
            d(`Observable for ${key} completed!`);
          }));
          
      hasSubscribed = true;
      return latestValue;
    },
    set: function() {
      throw new Error(`Cannot assign Derived Property ${key}`);
    }
  };
}

export class Model {
  constructor() {
    this.changing = new Subject();
    this.changed = new Subject();
    this.innerDisp = new Subscription();
  }
  
  unsubscribe() {
    this.innerDisp.unsubscribe();
  }
}
