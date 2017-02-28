import {expect, TestClass} from '../support';
import {Observable} from 'rxjs/Rx';

import '../../src/lib/custom-operators';

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

