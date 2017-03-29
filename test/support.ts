import * as path from 'path';
import { fromObservable, Model, notify } from '../src/lib/model';
import { Updatable } from '../src/lib/updatable';
import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';
import { config } from 'dotenv';
import { ISuiteCallbackContext } from 'mocha';

let chai = require('chai');
let chaiAsPromised = require('chai-as-promised');

chai.should();
chai.use(chaiAsPromised);

config();

export function describeIntegration(name: string, fn: ((this: ISuiteCallbackContext) => void)) {
  if (!process.env.SLACK_API_TOKEN || process.type !== 'renderer') {
    describe.skip(name, fn);
  } else {
    describe(name, fn);
  }
}

@notify('foo', 'bar', 'arrayFoo')
export class TestClass extends Model {
  someSubject: Subject<number>;
  foo: number;
  bar: number;
  baz: number;
  arrayFoo: number[];
  updatableFoo: Updatable<number>;
  @fromObservable derived: number;
  @fromObservable subjectDerived: number;

  get explodingProperty(): TestClass {
    throw new Error('Kaplowie');
  }

  constructor() {
    super();
    this.arrayFoo = [1];
    this.updatableFoo = new Updatable(() => Observable.of(6));
    this.someSubject = new Subject();

    Observable.of(42).toProperty(this, 'derived');
    this.someSubject
      .map((x) => x * 10)
      .startWith(0)
      .toProperty(this, 'subjectDerived');
  }
}

before(function() {
  // NB: We do this so that coverage is more accurate
  this.timeout(30 * 1000);
  require('../src/slack-app');
});

after(() => {
  if (!('__coverage__' in window)) {
    if (process.env.BABEL_ENV === 'test') throw new Error("electron-compile didn't generate coverage info!");
    return;
  }

  console.log('Writing coverage information...');

  const { Reporter, Collector } = require('istanbul');

  const coll = new Collector();
  coll.add(window.__coverage__);

  const reporter = new Reporter(null, path.join(__dirname, '..', 'coverage'));
  reporter.addAll(['text-summary', 'lcovonly']);

  return new Promise((res) => {
    reporter.write(coll, true, res);
  });
});

export const {expect, assert} = chai;