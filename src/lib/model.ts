import { Observable } from 'rxjs/Observable';
import { ISubscription, Subscription } from 'rxjs/Subscription';
import { Subject } from 'rxjs/Subject';

import * as isEqual from 'lodash.isequal';
import * as debug from 'debug';

import './standard-operators';

const d = debug('trickline:model');

export interface ChangeNotification {
  sender: any;
  property: string;
  value?: any;
}

export interface TypedChangeNotification<TSender, TVal> extends ChangeNotification {
  sender: TSender;
  property: string;
  value?: TVal;
}

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

export function fromObservable(target: Model, propertyKey: string): void {
  if (propertyKey in target) delete target[propertyKey];

  const obsPropertyKey: string = `___${propertyKey}_Observable`;
  const valPropertyKey: string = `___${propertyKey}_Latest`;
  const subPropertyKey: string = `___${propertyKey}_Subscription`;

  target[obsPropertyKey] = null;

  Object.defineProperty(target, propertyKey, {
    get: function(this: Model): any {
      if (!this[subPropertyKey]) {
        this[subPropertyKey] = new Subscription();

        const observableForProperty = this[obsPropertyKey] as Observable<any>;
        if (!observableForProperty) throw new Error(`Cannot find '${propertyKey}' on ${target.constructor.name}`);

        this[subPropertyKey].add(observableForProperty.subscribe(
          (x) => {
            if (isEqual(this[valPropertyKey], x)) return;

            this.changing.next({sender: target, property: propertyKey, value: this[valPropertyKey]});
            this[valPropertyKey] = x;
            this.changed.next({sender: target, property: propertyKey, value: this[valPropertyKey]});
          }, (e) => {
            d(`ToProperty on key ${propertyKey} failed! Last value was ${JSON.stringify(this[valPropertyKey])}`);
            setTimeout(() => { throw e; }, 10);
          }, () => {
            d(`Observable for ${propertyKey} completed!`);
          }));

        this[subPropertyKey].add(() => {
          if (this[valPropertyKey] instanceof Model) this[valPropertyKey].unsubscribe();
          this[obsPropertyKey] = null;
          this[valPropertyKey] = null;
        });

        this.innerDisp.add(this[subPropertyKey]);
      }

      return this[valPropertyKey];
    },
    set: () => {
      throw new Error(`Cannot set '${propertyKey}' on ${target.constructor.name}: Observable properties are read-only`);
    }
  });
}

export function toProperty<T>(this: Observable<T>, target: Model, propertyKey: string) {
  const obsPropertyKey: string = `___${propertyKey}_Observable`;
  if (!(obsPropertyKey in target)) {
    throw new Error(`Make sure to mark ${propertyKey} with the @fromObservable decorator`);
  }

  target[obsPropertyKey] = this;
  // tslint:disable-next-line:no-unused-variable
  const _dontcare = target[propertyKey];
}

Observable.prototype['toProperty'] = toProperty;
declare module 'rxjs/Observable' {
  interface Observable<T> {
    toProperty: typeof toProperty;
  }
}

export interface WhenSelector<TRet> { (...vals: Array<any>) : TRet; }

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

  addTeardown(teardown: ISubscription | Function | void) {
    this.innerDisp.add(teardown);
  }
}
