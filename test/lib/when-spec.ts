import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';
import { Updatable } from '../../src/lib/updatable';
import { getValue } from '../../src/lib/when';

import {expect, TestClass} from '../support';

describe('the getValue method', function() {
  it ('should fetch simple values', function() {
    let fixture = new TestClass();

    fixture.bar = 4;
    expect(getValue(fixture, f => f.bar).result).to.equal(4);

    fixture.bar = 10;
    expect(getValue(fixture, f => f.bar).result).to.equal(10);
  });

  it ('should fetch through Updatable values', function() {
    let fixture = new TestClass();
    expect(getValue(fixture, f => f.updatableFoo).result).to.equal(6);

    fixture.updatableFoo.playOnto(Observable.of(10));
    expect(getValue(fixture, f => f.updatableFoo).result).to.equal(10);
  });

  it ('should fetch through Updatable values even when explicitly requested', function() {
    let fixture = new TestClass();
    expect(getValue(fixture, f => f.updatableFoo.value).result).to.equal(6);

    fixture.updatableFoo.playOnto(Observable.of(10));
    expect(getValue(fixture, f => f.updatableFoo.value).result).to.equal(10);
  });

  it ('should fetch through Updatable when its the first one', function() {
    let fixture = new Updatable(() => Observable.of(new TestClass));

    expect(getValue(fixture, f => f.updatableFoo).result).to.equal(6);
  });

  it ('should fetch through Updatable when its the first one even when explicitly requested', function() {
    let fixture = new Updatable(() => Observable.of(new TestClass));

    expect(getValue(fixture, f => f.value.updatableFoo).result).to.equal(6);
  });

  it ('should fail if it cant walk the entire property chain', function() {
    let fixture = new TestClass();
    let { result, failed } = getValue(fixture, f => f.blart.boop.bop);

    expect(failed).to.be.ok;
    expect(result).to.equal(undefined);
  });

  it ('should fail if walking the chain throws', function() {
    let fixture = new TestClass();
    let { result, failed } = getValue(fixture, f => f.explodingProperty.bar);

    expect(failed).to.be.ok;
    expect(result).to.equal(undefined);
  });

  it ('should fail if walking the chain throws in an Updatable', function() {
    let fixture = new TestClass();
    fixture.updatableFoo.playOnto(Observable.throw(new Error('die')));

    let { result, failed } = getValue(fixture, f => f.updatableFoo);

    expect(failed).to.be.ok;
    expect(result).to.equal(undefined);
  });
});