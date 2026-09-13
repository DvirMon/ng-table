import { computed, Injector, signal, type Signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { expectTypeOf } from 'vitest';
import { createTable } from './create-table';
import { createTableFeature } from './create-table-feature';
import { columnSchema } from '../schema/column-schema';
import { applyVisible } from '../schema/column-rules';
import type { Feature, RowOf, Shape } from '../engine/types';
import type { ColumnDef, ReadonlyStore, RowId, TableStore } from './types';

interface Row {
  id: string;
  name: string;
  status: string;
}

function makeColumns(): ColumnDef<Row>[] {
  return [
    { id: 'name', accessor: (row) => row.name, visible: true, order: 0, label: 'name' },
    { id: 'status', accessor: (row) => row.status, visible: true, order: 1, label: 'status' },
  ];
}

// Builds a live store instance the same way a component field does — inside an injection
// context, with a data signal, calling the positional `createTable(data, config, ...features)`
// form. Columns tests pass no rows; row tests seed rows via the `data` param.
function makeStore(
  columns: ColumnDef<Row>[] = makeColumns(),
  data: Row[] = []
): TableStore<Row> {
  return TestBed.runInInjectionContext(() =>
    createTable(signal(data), { trackBy: 'id', columns })
  );
}

/**
 * A synthetic feature carrying its own internal signal, whose `sort` stage reverses rows only
 * while `toggled` is on — used to prove `renderRows()` recomputes downstream of the pipeline
 * when a feature's own state changes, not just when the consumer's `data` signal re-emits.
 * Built with `createTableFeature()` per this step's scope: shipped `with-*` features aren't
 * converted to the one-argument factory shape until #72–#74.
 */
function withReversibleSort(): Feature<
  TableStore<Row>,
  { reversed: Signal<boolean>; toggleReverse(): void }
> {
  return createTableFeature(() => {
    const reversed = signal(false);
    return {
      members: {
        reversed: reversed.asReadonly(),
        toggleReverse: () => reversed.update((value) => !value),
      },
      stages: {
        sort: (rows) => (reversed() ? [...rows].reverse() : rows),
      },
    };
  });
}

describe('createTable', () => {
  it('normalizes a string trackBy shorthand into a function', () => {
    const store = makeStore();

    expect(store.trackBy({ id: 'r1', name: 'Ann', status: 'active' })).toBe(
      'r1'
    );
  });

  it('accepts a trackBy function as-is', () => {
    const store = TestBed.runInInjectionContext(() =>
      createTable(signal<Row[]>([]), {
        trackBy: (row: Row) => `row-${row.id}`,
        columns: makeColumns(),
      })
    );

    expect(store.trackBy({ id: 'r1', name: 'Ann', status: 'active' })).toBe(
      'row-r1'
    );
  });

  it('rows reflect the data signal directly, no internal effect', () => {
    const data = signal<Row[]>([{ id: 'r1', name: 'Ann', status: 'active' }]);
    const store = TestBed.runInInjectionContext(() =>
      createTable(data, { trackBy: 'id', columns: makeColumns() })
    );

    expect(store.rows()).toEqual([{ id: 'r1', name: 'Ann', status: 'active' }]);

    // A new emission flows straight through the pipeline, no flush needed.
    data.set([
      { id: 'r1', name: 'Ann', status: 'active' },
      { id: 'r2', name: 'Bob', status: 'inactive' },
    ]);
    expect(store.rows()).toHaveLength(2);
  });

  it('renderRows() 1:1-wraps rows() when no grouping is composed', () => {
    const rows: Row[] = [
      { id: 'r1', name: 'Ann', status: 'active' },
      { id: 'r2', name: 'Bob', status: 'inactive' },
    ];
    const store = makeStore(makeColumns(), rows);

    expect(store.renderRows()).toEqual([
      { id: 'r1', depth: 0, kind: 'row', data: rows[0], index: 0, sourceIndex: 0 },
      { id: 'r2', depth: 0, kind: 'row', data: rows[1], index: 1, sourceIndex: 1 },
    ]);
  });

  it('renderRows() derives its ids from trackBy', () => {
    const store = TestBed.runInInjectionContext(() =>
      createTable(
        signal<Row[]>([{ id: 'r1', name: 'Ann', status: 'active' }]),
        {
          trackBy: (row: Row) => `row-${row.id}`,
          columns: makeColumns(),
        }
      )
    );

    expect(store.renderRows()[0].id).toBe('row-r1');
  });

  it('renderRows() recomputes downstream of the pipeline, not just data re-emits', () => {
    const store = TestBed.runInInjectionContext(() =>
      createTable(
        signal<Row[]>([
          { id: 'r1', name: 'Ann', status: 'active' },
          { id: 'r2', name: 'Bob', status: 'inactive' },
        ]),
        { trackBy: 'id', columns: makeColumns() },
        withReversibleSort()
      )
    );

    expect(store.renderRows().map((r) => r.id)).toEqual(['r1', 'r2']);

    store.toggleReverse();

    expect(store.renderRows().map((r) => r.id)).toEqual(['r2', 'r1']);
  });

  it('gives each createTable() call independent state', () => {
    const storeA = makeStore(makeColumns(), [
      { id: 'r1', name: 'Ann', status: 'active' },
    ]);
    const storeB = makeStore();

    expect(storeA.rows()).toHaveLength(1);
    expect(storeB.rows()).toEqual([]);
  });

  it('composes with config.injector when called outside an injection context', () => {
    // The injector is resolved via TestBed *before* createTable runs, so createTable itself
    // never needs an ambient injection context — this is the escape hatch `config.injector`
    // exists for (mirrors Signal Forms' `form()`).
    const injector = TestBed.inject(Injector);

    const store = createTable(signal<Row[]>([]), {
      trackBy: 'id',
      columns: makeColumns(),
      injector,
    });

    expect(store.rows()).toEqual([]);
  });

  it('applies an inline columnsSchema function via applyVisible', () => {
    const store = TestBed.runInInjectionContext(() =>
      createTable(signal<Row[]>([]), {
        trackBy: 'id',
        columns: makeColumns(),
        columnsSchema: (path) => {
          applyVisible(path.status, { when: () => false });
        },
      })
    );

    expect(store.columns().find((column) => column.id === 'status')?.visible).toBe(
      false
    );
  });

  it('applies a standalone columnSchema() value via applyVisible', () => {
    const hideStatus = columnSchema<Row>((path) => {
      applyVisible(path.status, { when: () => false });
    });

    const store = TestBed.runInInjectionContext(() =>
      createTable(signal<Row[]>([]), {
        trackBy: 'id',
        columns: makeColumns(),
        columnsSchema: hideStatus,
      })
    );

    expect(store.columns().find((column) => column.id === 'status')?.visible).toBe(
      false
    );
  });

  it('composes two synthetic features where the second reads the first’s member', () => {
    const withCount = createTableFeature(() => ({
      members: { count: signal(2).asReadonly() },
    }));
    const withDoubledCount = createTableFeature((store: Shape & { count: Signal<number> }) => ({
      members: { doubled: computed(() => store.count() * 2) },
    }));

    const store = TestBed.runInInjectionContext(() =>
      createTable(
        signal<Row[]>([]),
        { trackBy: 'id', columns: makeColumns() },
        withCount,
        withDoubledCount
      )
    );

    expect(store.count()).toBe(2);
    expect(store.doubled()).toBe(4);
  });

  it('exposes a derive block’s member and lets it read the feature’s own member at construction', () => {
    let seenOwnMemberAtConstruction: unknown;
    const withDerived = createTableFeature(
      () => ({ members: { count: 3 } }),
      (input) => {
        seenOwnMemberAtConstruction = input.count;
        return { members: { doubled: computed(() => input.count * 2) } };
      }
    );

    const store = TestBed.runInInjectionContext(() =>
      createTable(
        signal<Row[]>([]),
        { trackBy: 'id', columns: makeColumns() },
        withDerived
      )
    );

    expect(seenOwnMemberAtConstruction).toBe(3);
    expect(store.doubled()).toBe(6);
  });

  it('rejects a derive block that declares pipeline behaviour, naming what it declared', () => {
    const withStagingBlock = createTableFeature(
      () => ({ members: { count: 3 } }),
      () => ({ stages: { sort: (rows) => rows } })
    );

    expect(() =>
      TestBed.runInInjectionContext(() =>
        createTable(
          signal<Row[]>([]),
          { trackBy: 'id', columns: makeColumns() },
          withStagingBlock
        )
      )
    ).toThrow(/may only contribute members, but it declared stages/);
  });

  it('rejects a member key declared by both a feature and its derive block, naming the key', () => {
    const withCollidingBlock = createTableFeature(
      () => ({ members: { count: 3 } }),
      () => ({ members: { count: signal(9).asReadonly() } })
    );

    expect(() =>
      TestBed.runInInjectionContext(() =>
        createTable(
          signal<Row[]>([]),
          { trackBy: 'id', columns: makeColumns() },
          withCollidingBlock
        )
      )
    ).toThrow(/the feature and its derive block both provide the "count" store member/);
  });

  it('composes a member-less synthetic feature that adds nothing', () => {
    const inert = createTableFeature(() => ({}));

    const withInert = TestBed.runInInjectionContext(() =>
      createTable(
        signal<Row[]>([]),
        { trackBy: 'id', columns: makeColumns() },
        inert
      )
    );
    const withoutInert = makeStore();

    expect(Object.keys(withInert).sort()).toEqual(
      Object.keys(withoutInert).sort()
    );
  });

  // ---------------------------------------------------------------------------------------
  // Type-level assertions. The vitest executor does NOT typecheck `expectTypeOf`/
  // `@ts-expect-error` — they are inert at runtime. These are only enforced by
  // `tsc -p libs/shared/table/tsconfig.spec.json --noEmit`, which is the verification step
  // for this describe block (also listed as the PR's verification command).
  // ---------------------------------------------------------------------------------------
  describe('types', () => {
    interface Invoice {
      id: string;
      total: number;
      status: 'paid' | 'open';
    }

    const invoiceColumns = [{ id: 'total' }];

    function withA(): Feature<TableStore<Invoice>, { a: Signal<number> }> {
      return createTableFeature(() => ({ members: { a: signal(1).asReadonly() } }));
    }

    function withB(): Feature<
      TableStore<Invoice> & { a: Signal<number> },
      { b(): void }
    > {
      return createTableFeature((store) => ({
        members: {
          b: () => {
            store.a();
          },
        },
      }));
    }

    /** Third synthetic feature: its config is a callback typed `(row: RowOf<In>) => boolean`
     * — the fixture case 15 exercises to prove the row type flows through generically. Never
     * composed into `composeInvoiceTable()`'s table, so case 21 can assert its member `c` is
     * absent. */
    function withMatchFlag<In extends Shape>(
      matches: (row: RowOf<In>) => boolean
    ): Feature<In, { c: Signal<boolean> }> {
      return createTableFeature((store) => {
        // Same static/dynamic seam `compose-table.ts` itself crosses (ADR-0003): `In` only
        // guarantees `rows: Signal<readonly unknown[]>` (`Shape`), so narrowing to
        // `RowOf<In>[]` to call the caller's own typed predicate needs a cast here.
        const hasMatch = computed(() =>
          (store as unknown as { rows: () => RowOf<In>[] }).rows().some(matches)
        );
        return { members: { c: hasMatch } };
      });
    }

    function composeInvoiceTable() {
      return TestBed.runInInjectionContext(() =>
        createTable(
          signal<Invoice[]>([]),
          { trackBy: 'id', columns: invoiceColumns },
          withA(),
          withB()
        )
      );
    }

    it('case 14 — zero type args: member types are recovered from two composed features', () => {
      const table = composeInvoiceTable();

      expectTypeOf(table).toMatchTypeOf<TableStore<Invoice>>();
      expectTypeOf(table.a).toEqualTypeOf<Signal<number>>();
      expectTypeOf(table.b).toEqualTypeOf<() => void>();
    });

    it('case 15 — the row type flows into a synthetic feature’s config callback', () => {
      withMatchFlag<TableStore<Invoice>>((row) => {
        expectTypeOf(row).toEqualTypeOf<Invoice>();
        return row.status === 'open';
      });
    });

    it('case 16 — a multi-feature composition is never widened to any', () => {
      const table = composeInvoiceTable();

      expectTypeOf(table).not.toBeAny();
    });

    it('case 17 — trap 1: a neighboring wildcard-input feature does not widen a typed feature’s member', () => {
      // `In: any` (a feature indifferent to prior members) is the realistic wildcard slot —
      // `Out: object` (not `any`) is what the overloads' own `Ok extends object` constraint
      // guarantees for any *legitimately authored* feature, so this is the shape that must
      // stay safe to compose next to a typed one.
      const anyFeature: Feature<any, object> = () => ({});

      const table = TestBed.runInInjectionContext(() =>
        createTable(
          signal<Invoice[]>([]),
          { trackBy: 'id', columns: invoiceColumns },
          anyFeature,
          withA()
        )
      );

      expectTypeOf(table.a).toEqualTypeOf<Signal<number>>();
    });

    it('case 18 — trap 2: an omitted derive block does not leak an index-signature member', () => {
      // NOTE (deviation from the step file): the acceptance check "removing the IsAny guard
      // makes this fail" refers to Step 5's original `NormalizeDerived<D>` mechanism. Step 5
      // shipped `createTableFeature` as two public overloads instead (no-derive vs.
      // with-derive) — the no-derive overload itself is what prevents the leak now, so that
      // specific acceptance check no longer applies as written. The assertions below still
      // hold and must pass.
      const table = TestBed.runInInjectionContext(() =>
        createTable(
          signal<Invoice[]>([]),
          { trackBy: 'id', columns: invoiceColumns },
          withA()
        )
      );

      expectTypeOf(table).not.toHaveProperty('__index');
      expectTypeOf<keyof typeof table>().toEqualTypeOf<'a' | keyof TableStore<Invoice>>();
    });

    // Trap 3: a derive helper whose return type is declared as an intersection collapses the
    // composed store to an unusable shape. `createTableFeature`'s derive overload returns a
    // single `Feature<In, Out & D>`, so the composed store stays exactly the base plus both
    // contributions — asserted here on #69's own derive helper. `withComputed` (#70) is the
    // other declaration site and asserts the same property there.
    it('case 19 — trap 3: the derive helper returns one Feature, not an intersection', () => {
      const withDerived = createTableFeature(
        () => ({ members: { a: signal(1).asReadonly() } }),
        () => ({ members: { d: signal('x' as const) } })
      );

      const table = TestBed.runInInjectionContext(() =>
        createTable(
          signal<Invoice[]>([]),
          { trackBy: 'id', columns: invoiceColumns },
          withDerived
        )
      );

      expectTypeOf(table).not.toBeAny();
      expectTypeOf<keyof typeof table>().toEqualTypeOf<
        'a' | 'd' | keyof TableStore<Invoice>
      >();
    });

    it('case 20 — a slot-1 feature reading a later slot’s member is a compile error (D25)', () => {
      const withEarlyReader = createTableFeature((store: TableStore<Invoice>) => {
        // @ts-expect-error — slot 1's static `In` has no knowledge of a later slot's member.
        void store.b;
        return { members: { early: signal(1).asReadonly() } };
      });

      void withEarlyReader;
    });

    it('case 21 — an uncomposed feature’s member is absent from the store type', () => {
      const table = composeInvoiceTable();

      expectTypeOf(table).not.toHaveProperty('c');
    });

    it('case 22 — a 16th feature argument matches no overload (D27, ARITY = 15)', () => {
      function noop<In extends Shape>(): Feature<In, object> {
        return createTableFeature(() => ({}));
      }

      const data = signal<Invoice[]>([]);
      const config = { trackBy: 'id' as const, columns: invoiceColumns };

      createTable(
        data,
        config,
        noop(),
        noop(),
        noop(),
        noop(),
        noop(),
        noop(),
        noop(),
        noop(),
        noop(),
        noop(),
        noop(),
        noop(),
        noop(),
        noop(),
        noop(),
        // @ts-expect-error — ARITY is 15; a 16th feature argument has no matching overload.
        noop()
      );
    });

    it('case 23 — an empty-members feature contributes {} not object to the intersection', () => {
      const inert = createTableFeature(() => ({ members: {} }));

      const table = TestBed.runInInjectionContext(() =>
        createTable(
          signal<Invoice[]>([]),
          { trackBy: 'id', columns: invoiceColumns },
          inert,
          withA()
        )
      );

      // An `& object` contribution (instead of `{}`) would fail this equality even though
      // both read the same at the value level.
      expectTypeOf(table).toEqualTypeOf<TableStore<Invoice> & { a: Signal<number> }>();
    });

    it('case 24 — indexById is read-only at the type level', () => {
      const table = composeInvoiceTable();

      expectTypeOf(table.indexById).toEqualTypeOf<Signal<ReadonlyMap<RowId, number>>>();
      // @ts-expect-error — `indexById` has no setter; only `.update()` exists on a WritableView.
      table.indexById = table.indexById;
    });

    it('case 25 — ReadonlyStore strips .update from a WritableView, passes a method through', () => {
      expectTypeOf<ReadonlyStore<TableStore<Invoice>>['value']>().toEqualTypeOf<
        Signal<Invoice[]>
      >();
    });
  });
});
