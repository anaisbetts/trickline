import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';
import { Updatable } from '../../src/lib/updatable';
import { getValue } from '../../src/lib/when';

import {observableForPropertyChain, notificationForProperty} from '../../src/lib/when';

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

/* OLD TEST CASES THAT SHOULD PROBABLY BE FIXED */

describe('the when method', function() {
  it('should notify me about props', function() {
    let fixture = { foo: new TestClass() };
    let inner = fixture.foo;

    let changes = notificationForProperty(inner, 'bar').createCollection();
    expect(changes.length).to.equal(0);

    inner.bar = 5;
    expect(changes.length).to.equal(1);
    expect(changes[0]).to.deep.equal({sender: inner, property: 'bar', value: 5});
    expect(Object.keys(changes[0]).length).to.equal(3);

    let changes2 = notificationForProperty(fixture, 'foo').createCollection();
    expect(changes2.length).to.equal(0);

    changes2.foo = new TestClass();
    expect(changes2.length).to.equal(0);
  });

  it('should return nothing for non-models', function() {
    let changes = notificationForProperty(5)
      .materialize()
      .createCollection();

    expect(changes.length).to.equal(0);

    let input = {foo: 'bar'};
    changes = notificationForProperty(input)
      .materialize()
      .createCollection();

    expect(changes.length).to.equal(0);

    input.foo = 'barrr';
    expect(changes.length).to.equal(0);
  });

  it('should return nothing for expressions it cant actually fetch', function() {
    let fixture = new TestClass();
    let result = observableForPropertyChain(fixture, '__nothere').createCollection();
    expect(result.length).to.equal(0);

    fixture.__nothere = 0;
    expect(result.length).to.equal(0);
  });

  it('should subscribe to a one-item expression chain', function() {
    let fixture = new TestClass();
    let result = observableForPropertyChain(fixture, 'foo').createCollection();
    expect(result.length).to.equal(1);

    fixture.foo = 5;
    expect(result.length).to.equal(2);
    expect(result[1]).to.deep.equal({ sender: fixture, property: 'foo', value: 5});

    fixture.foo = 5;
    expect(result.length).to.equal(2);

    fixture.foo = 7;
    expect(result.length).to.equal(3);

    expect(result[2]).to.deep.equal({ sender: fixture, property: 'foo', value: 7});
    expect(Object.keys(result[0]).length).to.equal(3);
    expect(Object.keys(result[1]).length).to.equal(3);
    expect(Object.keys(result[2]).length).to.equal(3);
  });

  it('distinct should do what I expect it to', function() {
    let input = [
      { foo: 'bar', baz: 1 },
      { foo: 'bar', baz: 2 },
      { foo: 'bar', baz: 2 },
      { foo: 'bar', baz: 3 },
      { foo: 'bar', baz: 3 }
    ];

    let result = Observable.of(...input)
      .distinctUntilChanged((a,b) => a.baz === b.baz)
      .createCollection();

    expect(result.length).to.equal(3);
    expect(result[0].baz).to.equal(1);
    expect(result[1].baz).to.equal(2);
    expect(result[2].baz).to.equal(3);
  });

  it('switch should do what I expect', function() {
    let input = new Subject();
    let result = input
      .map((x) => x.subj)
      .switch()
      .createCollection();

    expect(result.length).to.equal(0);

    input.next({subj: Observable.of(1,2,3).concat(Observable.never())});
    expect(result.length).to.equal(3);
    input.next({subj: Observable.of(4,5)});
    expect(result.length).to.equal(5);
  });

  it('should subscribe to a multi-item expression chain', function() {
    let fixture = new TestClass();
    fixture.bar = new TestClass();
    let barFixture = fixture.bar;

    let result = observableForPropertyChain(fixture, 'bar.foo').createCollection();
    expect(result.length).to.equal(1);
    expect(result[0].sender).to.equal(fixture);
    expect(result[0].property).to.equal('bar.foo');
    expect(result[0].value).to.equal(undefined);


    fixture.bar.foo = 5;
    expect(result.length).to.equal(2);
    expect(result[1].sender).to.equal(fixture);
    expect(result[1].property).to.equal('bar.foo');
    expect(result[1].value).to.equal(5);

    barFixture.foo = 8;
    expect(result.length).to.equal(3);
    expect(result[2].sender).to.equal(fixture);
    expect(result[2].property).to.equal('bar.foo');
    expect(result[2].value).to.equal(8);

    fixture.bar = new TestClass();
    expect(result.length).to.equal(4);
    expect(result[3].sender).to.equal(fixture);
    expect(result[3].property).to.equal('bar.foo');
    expect(result[3].value).to.equal(fixture.bar.foo);

    fixture.bar = 5;
    expect(result.length).to.equal(4);

    barFixture.foo = 7;
    expect(result.length).to.equal(4);
  });

  it('when should work in the single item case', function() {
    let fixture = new TestClass();
    let result = fixture.when('foo').createCollection();
    expect(result.length).to.equal(1);

    fixture.foo = 5;
    expect(result.length).to.equal(2);
    expect(result[1]).to.deep.equal({ sender: fixture, property: 'foo', value: 5});

    fixture.foo = 5;
    expect(result.length).to.equal(2);

    fixture.foo = 7;
    expect(result.length).to.equal(3);

    expect(result[2]).to.deep.equal({ sender: fixture, property: 'foo', value: 7});
    expect(Object.keys(result[0]).length).to.equal(3);
    expect(Object.keys(result[1]).length).to.equal(3);
    expect(Object.keys(result[2]).length).to.equal(3);
  });

  it('when should combine values', function() {
    let fixture = new TestClass();

    let result = fixture.when(
      'derived', 'subjectDerived',
      (x, y) => x.value + y.value).createCollection();

    fixture.someSubject.next(10);

    expect(fixture.derived).to.equal(42);
    expect(fixture.subjectDerived).to.equal(10*10);

    expect(result.length).to.equal(2);
    expect(result[1]).to.equal(10*10 + 42);

    fixture.someSubject.next(2);
    expect(result.length).to.equal(3);
    expect(result[2]).to.equal(2*10 + 42);
  });

  it('when should reach through Updatables', function() {
    let fixture = new TestClass();
    let result = fixture.when('updatableFoo').createCollection();

    expect(result.length).to.equal(1);
    expect(result[0].value).to.equal(6);

    fixture.updatableFoo.next(12);
    expect(result.length).to.equal(2);
    expect(result[1].value).to.equal(12);
  });
});
