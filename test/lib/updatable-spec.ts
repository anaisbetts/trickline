import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';
import { ArrayUpdatable, Updatable } from '../../src/lib/updatable';

import { expect } from '../support';

import '../../src/lib/custom-operators';

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

    input.error(new Error('Die'));
    expect(error).to.be.ok;

    error = null;
    fixture.subscribe(() => {}, (e) => error = e);
    expect(error).to.be.ok;

    input = new Subject();
    fixture = new Updatable(() => input);

    error = null;
    fixture.subscribe(() => {}, (e) => error = e);
    expect(error).not.to.be.ok;

    fixture.error(new Error('Die'));
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

  it('should execute onrelease handler', function() {
    let isReleased = false;
    let fixture = new Updatable<Object>(() => Observable.of({a: 1}), 'merge', () => isReleased = true);
    expect(isReleased).to.equal(false);

    let disp1 = fixture.subscribe();
    expect(isReleased).to.equal(false);
    let disp2 = fixture.subscribe();
    expect(isReleased).to.equal(false);

    disp2.unsubscribe();
    expect(isReleased).to.equal(false);
    disp1.unsubscribe();
    expect(isReleased).to.equal(true);
  });
});

describe('the ArrayUpdatable class', function() {
  it('mostly acts like a BehaviorSubject', function() {
    let fixture = new ArrayUpdatable(() => Observable.of([42]));
    expect(fixture.value).to.deep.equal([42]);

    let result;
    fixture.subscribe(x => result = x);
    expect(result).to.deep.equal([42]);

    fixture = new ArrayUpdatable(() => Observable.of([42]));
    result = -1;
    fixture.subscribe(x => result = x);
    expect(result).to.deep.equal([42]);
  });

  it('blows up when we trash it', function() {
    let input = new Subject<number[]>();
    let fixture = new ArrayUpdatable<number>(() => input);

    let error = null;
    fixture.subscribe(() => {}, (e) => error = e);
    expect(error).not.to.be.ok;

    input.error(new Error('Die'));
    expect(error).to.be.ok;

    error = null;
    fixture.subscribe(() => {}, (e) => error = e);
    expect(error).to.be.ok;

    input = new Subject();
    fixture = new ArrayUpdatable(() => input);

    error = null;
    fixture.subscribe(() => {}, (e) => error = e);
    expect(error).not.to.be.ok;

    fixture.error(new Error('Die'));
    expect(error).to.be.ok;
  });

  it('calls the factory input but replays it', function() {
    let input = new Subject<number[]>();
    let fixture = new ArrayUpdatable<number>(() => input);

    let value = [-1];
    let sub = fixture.subscribe(x => value = x);

    expect(value).to.deep.equal([-1]);

    input.next([42]);
    input.complete();
    sub.unsubscribe();
    expect(value).to.deep.equal([42]);

    value = [-1];
    fixture.subscribe(x => value = x).unsubscribe();
    expect(value).to.deep.equal([42]);

    value = [-1];
    fixture.subscribe(x => value = x);
    fixture.next([50]);
    expect(value).to.deep.equal([50]);
  });

  it("doesn't reset once next is called", function() {
    let fixture = new ArrayUpdatable<number>(() => Observable.of([-1]));
    fixture.next([42]);

    let latest;
    fixture.subscribe(x => latest = x);
    expect(latest).to.deep.equal([42]);
  });

  it('should watch the array that we submit', function() {
    const a = [1, 2, 3];
    const fixture = new ArrayUpdatable<number>(() => Observable.of(a));

    let changeList = fixture.createCollection();
    expect(changeList.length).to.equal(1);

    a.push(4);
    Platform.performMicrotaskCheckpoint();
    expect(changeList.length).to.equal(2);
    expect(changeList[1]).to.deep.equal(a);

    a.splice(0, 2);
    Platform.performMicrotaskCheckpoint();
    expect(changeList.length).to.equal(3);
    expect(changeList[2]).to.deep.equal(a);

    a.length = 0;
    Platform.performMicrotaskCheckpoint();
    expect(changeList.length).to.equal(4);
    expect(changeList[3]).to.deep.equal(a);
  });

  it('should stop tracking one array when we give a new one', function() {
    const a = [1, 2, 3];
    const fixture = new ArrayUpdatable<number>(() => Observable.of(a));

    let changeList = fixture.createCollection();
    expect(changeList.length).to.equal(1);

    a.push(4);
    Platform.performMicrotaskCheckpoint();
    expect(changeList.length).to.equal(2);
    expect(changeList[1]).to.deep.equal(a);

    const b = [4, 5, 6];
    fixture.next(b);
    expect(changeList.length).to.equal(3);
    expect(changeList[2]).to.deep.equal(b);

    a.push(5);
    Platform.performMicrotaskCheckpoint();
    expect(changeList.length).to.equal(3);
    expect(changeList[2]).to.deep.equal(b);
  });

  it('should execute onrelease handler', function() {
    let isReleased = false;
    const a = [1, 2, 3];
    const fixture = new ArrayUpdatable<number>(() => Observable.of(a));
    expect(isReleased).to.equal(false);

    let disp1 = fixture.subscribe();
    expect(isReleased).to.equal(false);
    let disp2 = fixture.subscribe();
    expect(isReleased).to.equal(false);

    disp2.unsubscribe();
    expect(isReleased).to.equal(false);
    disp1.unsubscribe();
    expect(isReleased).to.equal(true);
  });
});