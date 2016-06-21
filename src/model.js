import { Observable, Subscription, Subject } from 'rxjs/Rx';

const d = require('debug')('trickline:model');

function isObject(o) {
  return o === Object(o);
}

function getDescriptorsForProperty(target, name, descriptor) {
  let backingStoreName = `__${name}__`;
  
  let realProp = Object.assign({
    get: function() { return this[backingStoreName]; },
    set: function(newVal) {
      console.log("Calling Setter! " + this);
      if (this[backingStoreName] === newVal) return;
      
      console.log("Signaling changing! " + this[backingStoreName]);
      this.changing.next({sender: this, property: name, value: this[backingStoreName]});
      this[backingStoreName] = newVal;
      console.log("Signaling changed! " + this[backingStoreName]);
      this.changed.next({sender: this, property: name, value: newVal});
    }
  }, descriptor);
  
  let backingStoreProp = {
    value: undefined,
    writable: true,
    enumerable: false,
    configurable: false,
  };
  
  let ret = {};
  ret[name] = realProp; ret[backingStoreName] = backingStoreProp;
  return ret;
}

export function notify(...properties) {
  return (target) => {
    for (let prop of properties) {
      let descriptorList = getDescriptorsForProperty(
        target.prototype, prop, { configurable: true, enumerable: true });
        
      for (let k of Object.keys(descriptorList)) {
        console.log("Defining " + k);
        Object.defineProperty(target.prototype, k, descriptorList[k]);
      }
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
            this.changing.next({sender: this, property: key});
            latestValue = x;
            this.changed.next({sender: this, property: key});
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
  
  when(...props) {
  }
  
  static createGetterForPropertyChain_(chain) {
    let props = null;
    if (Array.isArray(chain)) {
      props = chain;
    } else {
      props = chain.split('.');
    }
  
    return function(target) { 
      let ret = target;
      for (let prop of props) {
        if (!isObject(ret) || !(prop in ret)) return {success: false};

        ret = ret[prop];
      }
      
      return {success: true, value: ret};
    };
  }
  
  static observableForPropertyChain_(target, chain, before=false) {
    let props = null;
    
    if (Array.isArray(chain)) {
      props = chain;
    } else {
      props = chain.split('.');
    }
    
    /*
    const identifier = /^[$A-Z_][0-9A-Z_$]*$/i;
    if (props.find((x) => x.match(identifier) === null)) {
      throw new Error("property name must be of the form 'foo.bar.baz'");
    }
    */
    
    let firstProp = props[0];
    let start = Model.notificationForProperty_(target, firstProp, before);
    
    if (isObject(target) && props[0] in target) {
      start = start.startWith({ sender: target, property: firstProp, value: target[firstProp] });
    }
    
    if (props.length === 1) {
      return start.distinctUntilChanged((x,y) => x.value === y.value);
    }
    
    return start    // target.foo
      .map((x) => {
        console.log(`Upper change! ${x.property}`);
        return Model.observableForPropertyChain_(x.value, props.slice(1), before)
          .map((y) => {
            // This is for target.foo.bar.baz, its sender will be
            // target.foo, and its property will be bar.baz
            console.log(`Inferior change! ${y.property}`);
            return { sender: target, property: `${firstProp}.${y.property}`, value: y.value };
          });
      })
      .switch()
      .distinctUntilChanged((x,y) => x.value === y.value);
  }

  static notificationForProperty_(target, prop, before=false) {
    console.log('Creating notifier for ' + prop);
    if (!(target instanceof Model)) {
      console.log("Returning never!");
      return Observable.never();
    }
    
    if (!(prop in target)) {
      console.log("Not a real prop!");
      return Observable.never();
    }
    
    console.log("Returning a real thing!");
    return target[before ? 'changing' : 'changed']
      .filter(({property}) => prop === property);
  }
}
