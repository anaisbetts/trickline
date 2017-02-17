import { Observable } from 'rxjs/Observable';
import { Subscription } from 'rxjs/Subscription';
import { Subject } from 'rxjs/Subject';
import { Updatable } from './sparse-map';

import * as debug from 'debug';

import './standard-operators';

const d = debug('trickline:model');

function isObject(o: any): Boolean {
  return o === Object(o);
}

export interface ChangeNotification {
  sender: Model;
  property: string;
  value?: any;
};

function getDescriptorsForProperty(name: string, descriptor: PropertyDescriptor) {
  let backingStoreName = `__${name}__`;

  let newDescriptor: PropertyDescriptor = {
    get: function(this: Model) { return this[backingStoreName]; },
    set: function(this: Model, newVal: any) {
      if (this[backingStoreName] === newVal) return;

      this.changing.next({sender: this, property: name, value: this[backingStoreName]});
      this[backingStoreName] = newVal;
      this.changed.next({sender: this, property: name, value: newVal});
    }
  };

  let realProp = Object.assign(newDescriptor, descriptor);

  let backingStoreProp = {
    value: undefined,
    writable: true,
    enumerable: false,
    configurable: false,
  };

  let ret: Object = {};
  ret[name] = realProp;
  ret[backingStoreName] = backingStoreProp;

  return ret;
}

export function notify(...properties: Array<string>) {
  return (target: Function) => {
    for (let prop of properties) {
      let descriptorList = getDescriptorsForProperty(
        prop, { configurable: true, enumerable: true });

      for (let k of Object.keys(descriptorList)) {
        Object.defineProperty(target.prototype, k, descriptorList[k]);
      }
    }
  };
}

export function asProperty(target: Object, key: string, descriptor: PropertyDescriptor) {
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

  let ret: PropertyDescriptor = {
    configurable: descriptor.configurable || true,
    enumerable: descriptor.enumerable || true,

    get: function(this: any) {
      let that = this;
      if (that[hasSubscribedKey]) return that[latestValueKey];
      let observable: Observable<any> = that[generatorKey]();

      this.innerDisp.add(observable
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

  return ret;
}

export interface WhenSelector<TRet> { (...vals: Array<any>) : TRet; };

const identifier = /^[$A-Z_][0-9A-Z_$]*$/i;
export class Model {
  changing: Subject<ChangeNotification>;
  changed: Subject<ChangeNotification>;
  innerDisp: Subscription;

  constructor() {
    this.changing = new Subject();
    this.changed = new Subject();
    this.innerDisp = new Subscription();
  }

  unsubscribe() {
    this.innerDisp.unsubscribe();
  }

  when<TRet>(prop1: string): Observable<TRet>;
  when<TRet>(prop1: string, prop2: string, sel: WhenSelector<TRet>): Observable<TRet>;
  when<TRet>(prop1: string, prop2: string, prop3: string, sel: WhenSelector<TRet>): Observable<TRet>;
  when<TRet>(prop1: string, prop2: string, prop3: string, prop4: string, sel: WhenSelector<TRet>): Observable<TRet>;
  when(...propsAndSelector: Array<string|Function>): Observable<any> {
    if (propsAndSelector.length < 1) {
      throw new Error('Must specify at least one property!');
    }

    if (propsAndSelector.length === 1) {
      return Model.observableForPropertyChain_(this, propsAndSelector[0] as string);
    }

    let [selector] = propsAndSelector.splice(-1, 1);
    if (!(selector instanceof Function)) {
      throw new Error('In multi-item properties, the last function must be a selector');
    }

    let propsOnly = propsAndSelector as Array<string>;
    let propWatchers = propsOnly.map((p) => Model.observableForPropertyChain_(this, p));
    return Observable.combineLatest(...propWatchers, selector).distinctUntilChanged();
  }

  static createGetterForPropertyChain_(chain: (Array<string> | string)) {
    let props: Array<string>;

    if (Array.isArray(chain)) {
      props = chain;
    } else {
      props = chain.split('.');
    }

    return function(target: any) {
      let ret = target;
      for (let prop of props) {
        if (!isObject(ret) || !(prop in ret)) return {success: false};

        ret = ret[prop];
      }

      return {success: true, value: ret};
    };
  }

  static observableForPropertyChain_(target: any, chain: (Array<string> | string), before = false): Observable<ChangeNotification> {
    let props: Array<string>;

    if (Array.isArray(chain)) {
      props = chain;
    } else {
      props = chain.split('.');

      if (props.find((x) => x.match(identifier) === null)) {
        throw new Error("property name must be of the form 'foo.bar.baz'");
      }
    }

    let firstProp = props[0];
    let start = Model.notificationForProperty_(target, firstProp, before);

    if (isObject(target) && props[0] in target) {
      let val = target[firstProp];

      if (isObject(val) && (val instanceof Updatable)) {
        val = val.value;
      }

      start = start.startWith({ sender: target, property: firstProp, value: val });
    }

    if (props.length === 1) {
      return start.distinctUntilChanged((x, y) => x.value === y.value);
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
      .distinctUntilChanged((x, y) => x.value === y.value);
  }

  static notificationForProperty_(target: any, prop: string, before = false): Observable<ChangeNotification> {
    if (!(target instanceof Model)) {
      return Observable.never();
    }

    if (!(prop in target)) {
      return Observable.never();
    }

    if (target[prop] instanceof Updatable) {
      return (before ? target.changing : target.changed)
        .startWith({sender: target, property: prop, value: target[prop]})
        .filter(({property}) => prop === property)
        .switchMap(cn => {
          let obs: Observable<any> = cn.value;
          return obs.skip(1)
            .map((value) => ({ sender: cn.sender, property: cn.property, value }));
        });
    }

    return (before ? target.changing : target.changed)
      .filter(({property}) => prop === property);
  }
}
