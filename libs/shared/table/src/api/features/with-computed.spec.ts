import { computed, signal, type Signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { mockRows, mockTrackBy, type MockRow } from '../../table.mock';
import { createTable } from '../create-table';
import { createTableFeature } from '../create-table-feature';
import { withComputed } from './with-computed';
import type { AnyTableFeature, ColumnDefInput, TableStore } from '../types';
import type { Feature, TableFeatureSpec } from '../../engine/types';

function makeColumns(): ColumnDefInput<MockRow>[] {
  return [{ id: 'name' }];
}

/** Overload set for `makeStore`, mirroring `createTable`'s own per-arity typing (`CreateTableOverloads`)
 * so each call site keeps full member inference instead of widening rest features to `AnyTableFeature[]`. */
interface MakeStore {
  (data: WritableSignal<MockRow[]>): TableStore<MockRow>;
  <O1 extends object>(
    data: WritableSignal<MockRow[]>,
    f1: Feature<TableStore<MockRow>, O1>
  ): TableStore<MockRow> & O1;
  <O1 extends object, O2 extends object>(
    data: WritableSignal<MockRow[]>,
    f1: Feature<TableStore<MockRow>, O1>,
    f2: Feature<TableStore<MockRow> & O1, O2>
  ): TableStore<MockRow> & O1 & O2;
}

/** `createTable`'s per-arity overloads match no spread call, so the runtime forward goes
 * through this variadic view of the same function — the static/dynamic seam `create-table.ts`
 * bridges the same way internally. `MakeStore` is what callers type against. */
type CreateTableVariadic = (
  data: WritableSignal<MockRow[]>,
  config: { trackBy: typeof mockTrackBy; columns: ColumnDefInput<MockRow>[] },
  ...features: AnyTableFeature[]
) => TableStore<MockRow>;

/** Wraps `TestBed.runInInjectionContext(() => createTable(data, { trackBy, columns }, ...features))`
 * for this file's fixed `trackBy`/`columns` — the caller supplies the data signal so tests can
 * mutate it afterward via `data.set(...)`. */
const makeStore = ((data: WritableSignal<MockRow[]>, ...features: AnyTableFeature[]): TableStore<MockRow> =>
  TestBed.runInInjectionContext(() =>
    (createTable as unknown as CreateTableVariadic)(
      data,
      { trackBy: mockTrackBy, columns: makeColumns() },
      ...features
    )
  )) as MakeStore;

type WithA = { a: Signal<number> };
type WithN = { n: Signal<number> };

/** Synthetic feature — the un-wrapped factory, needed standalone for the trailing-derive-block
 * placement (case 5), which composes `createTableFeature(fAFactory, withComputed(...))` directly. */
function fAFactory(input: TableStore<MockRow>): TableFeatureSpec<MockRow, WithA> {
  return { members: { a: computed(() => input.rows().length * 10) } };
}

/** Synthetic feature contributing `a: Signal<number>` — row count * 10. */
function fA(): Feature<TableStore<MockRow>, WithA> {
  return createTableFeature(fAFactory);
}

/** Synthetic feature contributing `b: Signal<string>`, derived from a `withComputed`-declared
 * `n` member on the store it's handed — proves a later slot sees the block's contribution. */
function fB(): Feature<TableStore<MockRow> & WithN, { b: Signal<string> }> {
  return createTableFeature((input) => ({
    members: { b: computed(() => `n=${input.n()}`) },
  }));
}

describe('withComputed', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('own slot placement', () => {
    it('exposes a computed member reflecting row count', () => {
      const data = signal([...mockRows]);
      const store = makeStore(
        data,
        withComputed((s) => ({ n: computed(() => s.rows().length) }))
      );

      expect(store.n()).toBe(3);
    });

    it('reads an earlier feature member declared before it in the fold', () => {
      const data = signal([...mockRows]);
      const store = makeStore(
        data,
        fA(),
        withComputed((s) => ({ n: computed(() => s.a()) }))
      );

      expect(store.n()).toBe(30);
    });

    it('a following synthetic feature reads input.n from the store it is handed at factory time', () => {
      const data = signal([...mockRows]);
      const store = makeStore(
        data,
        withComputed((s) => ({ n: computed(() => s.rows().length) })),
        fB()
      );

      expect(store.b()).toBe('n=3');
    });

    it('recomputes only when its input changes; reading twice without a change is stable', () => {
      const data = signal([...mockRows]);
      let evalCount = 0;
      const store = makeStore(
        data,
        withComputed((s) => ({
          n: computed(() => {
            evalCount++;
            return s.rows().length;
          }),
        }))
      );

      expect(store.n()).toBe(3);
      expect(evalCount).toBe(1);

      store.n();
      expect(evalCount).toBe(1);

      data.set([...mockRows, { id: 4, name: 'Dee' }]);
      expect(store.n()).toBe(4);
      expect(evalCount).toBe(2);
    });
  });

  describe('trailing argument placement', () => {
    it('sees the feature it derives from at construction and contributes twice = a * 2', () => {
      const spy = vi.fn();
      const feature: Feature<TableStore<MockRow>, WithA & { twice: Signal<number> }> =
        createTableFeature(
          fAFactory,
          withComputed((s) => {
            spy(s.a());
            return { twice: computed(() => s.a() * 2) };
          })
        );

      const data = signal([...mockRows]);
      const store = makeStore(data, feature);

      expect(store.a()).toBe(30);
      expect(store.twice()).toBe(60);
      expect(spy).toHaveBeenCalledWith(30);
    });
  });

  describe('construction errors', () => {
    it('throws naming the feature position and the colliding core key', () => {
      const shadowsRows: Feature<TableStore<MockRow>, { rows: Signal<unknown[]> }> = withComputed(
        () => ({ rows: signal([]) })
      );
      const attempt = () => makeStore(signal([...mockRows]), shadowsRows);

      expect(attempt).toThrow(expect.stringContaining('feature 1 (withComputed)'));
      expect(attempt).toThrow(expect.stringContaining('"rows"'));
    });

    it('throws naming an earlier feature and withComputed for a repeated member key', () => {
      const collidesWithA: Feature<TableStore<MockRow> & WithA, WithA> = withComputed(() => ({
        a: signal(0),
      }));
      const attempt = () => makeStore(signal([...mockRows]), fA(), collidesWithA);

      expect(attempt).toThrow(expect.stringContaining('feature 1'));
      expect(attempt).toThrow(expect.stringContaining('feature 2 (withComputed)'));
    });

    it('throws naming both positions when two withComputed blocks claim the same key', () => {
      const first: Feature<TableStore<MockRow>, { x: Signal<number> }> = withComputed(() => ({
        x: computed(() => 1),
      }));
      const second: Feature<TableStore<MockRow> & { x: Signal<number> }, { x: Signal<number> }> =
        withComputed(() => ({ x: computed(() => 2) }));
      const attempt = () => makeStore(signal([...mockRows]), first, second);

      expect(attempt).toThrow(expect.stringContaining('feature 1 (withComputed)'));
      expect(attempt).toThrow(expect.stringContaining('feature 2 (withComputed)'));
    });

    it('throws naming a non-signal member', () => {
      // Cast defeats the `DerivedDict` type constraint — a JS consumer could return this too,
      // so the runtime assertion is exercised directly.
      const nonSignal: Feature<TableStore<MockRow>, { n: Signal<number> }> = withComputed(
        () => ({ n: 42 }) as unknown as { n: Signal<number> }
      );
      const attempt = () => makeStore(signal([...mockRows]), nonSignal);

      expect(attempt).toThrow(expect.stringContaining('"n"'));
    });

    it('wraps a block that throws while declaring members, preserving the original as cause', () => {
      const throwingFeature: Feature<TableStore<MockRow>, {}> = withComputed(() => {
        throw new Error('boom');
      });

      let caught: unknown;
      try {
        makeStore(signal([...mockRows]), throwingFeature);
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(Error);
      const error = caught as Error;
      expect(error.message).toContain('withComputed');
      expect(error.cause).toBeInstanceOf(Error);
      expect((error.cause as Error).message).toBe('boom');
    });
  });

  describe('evaluation errors (ADR-0014 / D9)', () => {
    it('reports once per throw, caches until the dependency changes, and leaves other members readable', () => {
      const data = signal<MockRow[]>([mockRows[0]]);
      const store = makeStore(
        data,
        withComputed((s) => ({
          bad: computed(() => {
            if (s.rows().length > 1) {
              throw new Error('eval');
            }
            return 1;
          }),
          ok: computed(() => 1),
        }))
      );

      expect(store.bad()).toBe(1);

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      data.set([mockRows[0], mockRows[1]]);
      expect(() => store.bad()).toThrow('eval');
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('derived member "bad"'),
        expect.any(Error)
      );

      // Same dependency value, no change — cached, spy stays at one call.
      expect(() => store.bad()).toThrow('eval');
      expect(errorSpy).toHaveBeenCalledTimes(1);

      expect(store.ok()).toBe(1);
      expect(store.rows()).toHaveLength(2);

      data.set([mockRows[0], mockRows[1], mockRows[2]]);
      expect(() => store.bad()).toThrow('eval');
      expect(errorSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('persistence', () => {
    it.todo(
      'derived members are excluded from a persistence snapshot — assert once state-persistence.md owns a slice (#78)'
    );
  });
});
