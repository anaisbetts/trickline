import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';
import { Updatable } from '../src/sparse-map';

import {expect} from './support';

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

  it('plays onto from only one source at a time', function() {
    let input1 = new Subject<number>();
    let input2 = new Subject<number>();

    let latest = 0;
    let fixture = new Updatable<number>();
    fixture.subscribe(x => latest = x);
    expect(latest).to.equal(0);

    fixture.playOnto(input1);
    expect(latest).to.equal(0);

    input2.next(2);
    expect(latest).to.equal(0);

    input1.next(1);
    expect(latest).to.equal(1);

    fixture.playOnto(input2);
    expect(latest).to.equal(1);

    input1.next(2);
    expect(latest).to.equal(1);

    input2.next(2);
    expect(latest).to.equal(2);
  });

  it("doesn't reset once next is called", function() {
    let fixture = new Updatable<number>(() => Observable.of(-1));
    fixture.next(42);

    let latest = 0;
    fixture.subscribe(x => latest = x);
    expect(latest).to.equal(42);
  });
});