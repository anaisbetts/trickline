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
      if (this[backingStoreName] === newVal) return;
      
      this.changing.next({sender: this, property: name, value: this[backingStoreName]});
      this[backingStoreName] = newVal;
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
        Object.defineProperty(target.prototype, k, descriptorList[k]);
      }
    }
  };
}

export function asProperty(target, key, descriptor) {
  let hasSubscribedKey = `__hasSubscribed_${key}`;
  let latestValueKey = `__latestValue_${key}`;
  let generatorKey = `__generator_${key}`;
  
  [hasSubscribedKey, latestValueKey].forEach((x) => {
    Object.defineProperty(target, x, {
      configurable: false,
      enumerable: false,
      writable: true,
      value: undefined
    });
  });
  
  Object.defineProperty(target, generatorKey, {
    configurable: false,
    enumerable: false,
    value: descriptor.value
  });
  
  return {
    configurable: descriptor.configurable || true,
    enumerable: descriptor.enumerable || true,
    get: function() {
      let that = this;
      if (that[hasSubscribedKey]) return that[latestValueKey];
      
      this.innerDisp.add(that[generatorKey]()
        .filter((x) => that[latestValueKey] !== x)
        .subscribe(
          function(x) {
            that.changing.next({sender: that, property: key, value: that[latestValueKey]});
            that[latestValueKey] = x;
            that.changed.next({sender: that, property: key, value: x});
          }, (e) => { throw e; }, () => {
            d(`Observable for ${key} completed!`);
          }));
          
      that[hasSubscribedKey] = true;
      return that[latestValueKey];
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
  
  when(...propsAndSelector) {
    if (propsAndSelector.length < 1) {
      throw new Error("Must specify at least one property!");
    }
    
    if (propsAndSelector.length === 1) {
      return Model.observableForPropertyChain_(this, propsAndSelector[0]);
    }
    
    let [selector] = propsAndSelector.splice(-1, 1);
    if (!(selector instanceof Function)) {
      throw new Error("In multi-item properties, the last function must be a selector");
    }
    
    let propWatchers = propsAndSelector.map((p) => Model.observableForPropertyChain_(this, p));
    return Observable.combineLatest(...propWatchers, selector).distinctUntilChanged();
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
        return Model.observableForPropertyChain_(x.value, props.slice(1), before)
          .map((y) => {
            // This is for target.foo.bar.baz, its sender will be
            // target.foo, and its property will be bar.baz
            return { sender: target, property: `${firstProp}.${y.property}`, value: y.value };
          });
      })
      .switch()
      .distinctUntilChanged((x,y) => x.value === y.value);
  }

  static notificationForProperty_(target, prop, before=false) {
    if (!(target instanceof Model)) {
      return Observable.never();
    }
    
    if (!(prop in target)) {
      return Observable.never();
    }
    
    return target[before ? 'changing' : 'changed']
      .filter(({property}) => prop === property);
  }
}
