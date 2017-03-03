import { Observable } from 'rxjs/Observable';

import { MergeStrategy } from '../../src/lib/updatable';
import { InMemorySparseMap, SparseMap } from '../../src/lib/sparse-map';
import { TestClass, expect } from '../support';

export type ValueFactoryFunction =
  ((key: string, hint?: any) => Observable<Object>);
export type CreateFixtureFunction =
  ((factory: ValueFactoryFunction, strategy: MergeStrategy) => SparseMap<string, Object>);

function testsForClass(Klass: Function, createFixture: CreateFixtureFunction) {
  const name = Klass.name;

  describe(`The ${name} class interface implementation`, function() {
    it ('smoke tests successfully', function() {
      let fixture = createFixture(() => Observable.of(new TestClass()), 'overwrite');

      let result = fixture.listen('foo');
      expect((result.value as TestClass).derived).to.equal(42);
    });

    it ('creates Updatables with Merge Strategy semantics', function() {
      let fixture = createFixture(() => Observable.of({a: 1}), 'merge');

      let result = fixture.listen('foo');
      expect(result.value).to.deep.equal({a: 1});

      result.next({b: 2});
      expect(result.value).to.deep.equal({a: 1, b: 2});
    });
  });
}

testsForClass(InMemorySparseMap, (factory, strategy) => {
  return new InMemorySparseMap(factory, strategy);
});