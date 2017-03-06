import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';
import { Updatable } from '../../src/lib/updatable';

import { expect } from '../support';

describe('The Updatable class', function() {
  it('mostly acts like a BehaviorSubject', function() {
    let fixture = new Updatable(() => Observable.of(42));
    expect(fixture.value).to.equal(42);

    let result = -1;
    fixture.subscribe(x => result = x);
    expect(result).to.equal(42);

    fixture = new Updatable(() => Observable.of(42));
    result = -1;
    fixture.subscribe(x => result = x);
    expect(result).to.equal(42);
  });

  it('blows up when we trash it', function() {
    let input = new Subject<number>();
    let fixture = new Updatable<number>(() => input);

    let error = null;
    fixture.subscribe(() => {}, (e) => error = e);
    expect(error).not.to.be.ok;

    input.error(new Error("Die"));
    expect(error).to.be.ok;

    error = null;
    fixture.subscribe(() => {}, (e) => error = e);
    expect(error).to.be.ok;

    input = new Subject();
    fixture = new Updatable(() => input);

    error = null;
    fixture.subscribe(() => {}, (e) => error = e);
    expect(error).not.to.be.ok;

    fixture.error(new Error("Die"));
    expect(error).to.be.ok;
  });

  it('calls the factory input but replays it', function() {
    let input = new Subject<number>();
    let fixture = new Updatable<number>(() => input);

    let value = -1;
    let sub = fixture.subscribe(x => value = x);

    expect(value).to.equal(-1);

    input.next(42);
    input.complete();
    sub.unsubscribe();
    expect(value).to.equal(42);

    value = -1;
    fixture.subscribe(x => value = x).unsubscribe();
    expect(value).to.equal(42);

    value = -1;
    fixture.subscribe(x => value = x);
    fixture.next(50);
    expect(value).to.equal(50);
  });

  it("doesn't reset once next is called", function() {
    let fixture = new Updatable<number>(() => Observable.of(-1));
    fixture.next(42);

    let latest = 0;
    fixture.subscribe(x => latest = x);
    expect(latest).to.equal(42);
  });

  it('shallow merges objects when used with the merge strategy', function() {
    let fixture = new Updatable<Object>(() => Observable.of({a: 1}), 'merge');
    expect(fixture.value).to.deep.equal({a: 1});

    fixture.next({b: 2});
    expect(fixture.value).to.deep.equal({a: 1, b: 2});

    fixture.next({a: 5});
    expect(fixture.value).to.deep.equal({a: 5, b: 2});
  });

  it('drops the current value on invalidate', function() {
    let fixture = new Updatable<Object>(() => Observable.of({a: 1}), 'merge');
    expect(fixture.value).to.deep.equal({a: 1});

    fixture.next({b: 2});
    expect(fixture.value).to.deep.equal({a: 1, b: 2});

    fixture.next({a: 5});
    expect(fixture.value).to.deep.equal({a: 5, b: 2});

    fixture.invalidate();
    expect(fixture.value).to.deep.equal({a: 1});
  });
});