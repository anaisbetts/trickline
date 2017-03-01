import { fromObservable, Model, notify } from '../src/lib/model';
import { Updatable } from '../src/lib/updatable';
import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';

let chai = require("chai");
let chaiAsPromised = require("chai-as-promised");

chai.should();
chai.use(chaiAsPromised);


@notify('foo', 'bar')
export class TestClass extends Model {
  someSubject: Subject<number>;
  foo: Number;
  bar: Number;
  baz: Number;
  updatableFoo: Updatable<number>;
  @fromObservable derived: number;
  @fromObservable subjectDerived: number;

  get explodingProperty(): TestClass {
    throw new Error('Kaplowie');
  }

  constructor() {
    super();
    this.updatableFoo = new Updatable(() => Observable.of(6));
    this.someSubject = new Subject();

    Observable.of(42).toProperty(this, 'derived');
    this.someSubject
      .map((x) => x * 10)
      .startWith(0)
      .toProperty(this, 'subjectDerived');
  }
}

export const {expect, assert} = chai;