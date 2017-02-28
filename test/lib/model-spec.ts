import {expect} from '../support';
import {Observable, Subject} from 'rxjs/Rx';

import {fromObservable, notify, Model} from '../../src/lib/model';
import {Updatable} from '../../src/lib/updatable';

import '../../src/lib/custom-operators';

@notify('foo', 'bar')
class TestClass extends Model {
  someSubject: Subject<number>;
  foo: Number;
  bar: Number;
  baz: Number;
  updatableFoo: Updatable<number>;
  @fromObservable derived: number;
  @fromObservable subjectDerived: number;

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

describe('the notify attribute', function() {
  it('should notify me!', function() {
    let fixture = new TestClass();

    let result = Observable.merge(
      fixture.changing.map((x) => ({ changing: true, name: x.property })),
      fixture.changed.map((x) => ({ changing: false, name: x.property }))
    ).createCollection();

    expect(result.length).to.equal(0);

    fixture.foo = 5;
    expect(result.length).to.equal(2);
    expect(result[0]).to.deep.equal({ changing: true, name: 'foo' });
    expect(result[1]).to.deep.equal({ changing: false, name: 'foo' });

    fixture.foo = 5;
    expect(result.length).to.equal(2);

    fixture.foo = 7;
    expect(result.length).to.equal(4);
    expect(result[2]).to.deep.equal({ changing: true, name: 'foo' });
    expect(result[3]).to.deep.equal({ changing: false, name: 'foo' });

    fixture.baz = 7;
    expect(result.length).to.equal(4);

    fixture.bar = 7;
    expect(result.length).to.equal(6);
  });
});

describe('the toProperty method', function() {
  it('should return a canned value', function() {
    let fixture = new TestClass();

    expect(fixture.derived).to.equal(42);
  });

  it('should notify on changes', function() {
    let fixture = new TestClass();
    expect(fixture.subjectDerived).to.equal(0);

    let changes = Observable.merge(
      fixture.changing.map((x) => ({ changing: true, name: x.property })),
      fixture.changed.map((x) => ({ changing: false, name: x.property }))
    ).createCollection();

    expect(changes.length).to.equal(0);

    fixture.someSubject.next(10);
    expect(fixture.subjectDerived).to.equal(100);
    expect(changes[0]).to.deep.equal({ changing: true, name: 'subjectDerived' });
    expect(changes[1]).to.deep.equal({ changing: false, name: 'subjectDerived' });
  });
});

describe('the when method', function() {
  it('should let me get props', function() {
    let f = { bamf: 10, foo: { bar: { baz: 5 } } };

    let result = Model.createGetterForPropertyChain_('bamf');
    expect(result(f)).to.deep.equal({success: true, value: 10});

    let result2 = Model.createGetterForPropertyChain_('foo.bar.baz');
    expect(result2(f)).to.deep.equal({success: true, value: 5});

    let result3 = Model.createGetterForPropertyChain_('foo.bar.nothere');
    expect(result3(f)).to.deep.equal({success: false});

    let result4 = Model.createGetterForPropertyChain_('nothere.bar.baz');
    expect(result4(f)).to.deep.equal({success: false});
  });

  it('should notify me about props', function() {
    let fixture = { foo: new TestClass() };
    let inner = fixture.foo;

    let changes = Model.notificationForProperty_(inner, 'bar').createCollection();
    expect(changes.length).to.equal(0);

    inner.bar = 5;
    expect(changes.length).to.equal(1);
    expect(changes[0]).to.deep.equal({sender: inner, property: 'bar', value: 5});
    expect(Object.keys(changes[0]).length).to.equal(3);

    let changes2 = Model.notificationForProperty_(fixture, 'foo').createCollection();
    expect(changes2.length).to.equal(0);

    changes2.foo = new TestClass();
    expect(changes2.length).to.equal(0);
  });

  it('should return nothing for non-models', function() {
    let changes = Model.notificationForProperty_(5)
      .materialize()
      .createCollection();

    expect(changes.length).to.equal(0);

    let input = {foo: 'bar'};
    changes = Model.notificationForProperty_(input)
      .materialize()
      .createCollection();

    expect(changes.length).to.equal(0);

    input.foo = 'barrr';
    expect(changes.length).to.equal(0);
  });

  it('should return nothing for expressions it cant actually fetch', function() {
    let fixture = new TestClass();
    let result = Model.observableForPropertyChain_(fixture, '__nothere').createCollection();
    expect(result.length).to.equal(0);

    fixture.__nothere = 0;
    expect(result.length).to.equal(0);
  });

  it('should subscribe to a one-item expression chain', function() {
    let fixture = new TestClass();
    let result = Model.observableForPropertyChain_(fixture, 'foo').createCollection();
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

    let result = Model.observableForPropertyChain_(fixture, 'bar.foo').createCollection();
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
