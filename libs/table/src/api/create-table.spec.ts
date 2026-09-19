import { computed, Injector, signal, type Signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { expectTypeOf } from 'vitest';
import { createTable } from './create-table';
import { createTableFeature } from './create-table-feature';
import { composeFeatures } from './features/compose-features';
import { withComputed } from './features/with-computed';
import { columnSchema } from '../schema/column-schema';
import { applyVisible } from '../schema/column-rules';
import type { Feature, RowOf, Shape } from '../engine/types';
import type { ColumnDef, ReadonlyStore, RenderRow, RowId, TableStore } from './types';

interface Row {
  id: string;
  name: string;
  status: string;
}

// No `ColumnDef<Row>[]` return annotation — that would widen `id` to `string` and turn
// `ColumnsPath` into an index signature (ADR-0019).
function makeColumns() {
  return [
    {
      id: 'name' as const,
      accessor: (row: Row) => row.name,
      visible: true,
      order: 0,
      label: 'name',
    },
    {
      id: 'status' as const,
      accessor: (row: Row) => row.status,
      visible: true,
      order: 1,
      label: 'status',
    },
  ] satisfies ColumnDef<Row>[];
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
 * converted to the one-argument factory shape until #38–#40.
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
    const hideStatus = columnSchema<Row, 'name' | 'status'>((path) => {
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
  // `tsc -p libs/table/tsconfig.spec.json --noEmit`, which is the verification step
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
    // contributions — asserted here on #35's own derive helper. `withComputed` (#36) is the
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

      TestBed.runInInjectionContext(() =>
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
        )
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

    // -------------------------------------------------------------------------------------
    // withComputed() (#36) — both placements, not-any, trap 3. Reuses this describe block's
    // own fixtures (`Invoice`, `invoiceColumns`, `withA`/`withB`) rather than duplicating them.
    // -------------------------------------------------------------------------------------

    it('case 26 — a top-level withComputed() block adds a typed signal member, not widened to any', () => {
      const table = TestBed.runInInjectionContext(() =>
        createTable(
          signal<Invoice[]>([]),
          { trackBy: 'id', columns: invoiceColumns },
          withA(),
          withComputed((s) => ({ n: computed(() => s.a()) }))
        )
      );

      expectTypeOf(table.n).toEqualTypeOf<Signal<number>>();
      expectTypeOf(table).not.toBeAny();
      expectTypeOf<keyof typeof table>().toEqualTypeOf<'a' | 'n' | keyof TableStore<Invoice>>();
    });

    it('case 27 — the block parameter is a ReadonlyStore: .update is stripped, reads pass through', () => {
      const readonlyCheck = withComputed<TableStore<Invoice>, { n: Signal<number> }>((s) => {
        expectTypeOf(s.value).toEqualTypeOf<Signal<Invoice[]>>();
        // @ts-expect-error — ReadonlyStore strips `.update` from the `value` WritableView (D28).
        s.value.update((rows) => rows);
        expectTypeOf(s.rows).toEqualTypeOf<Signal<Invoice[]>>();
        return { n: computed(() => s.value().length) };
      });

      void readonlyCheck;
    });

    it('case 28 — a block placed before a later feature does not see that feature’s member yet (D25)', () => {
      const table = TestBed.runInInjectionContext(() =>
        createTable(
          signal<Invoice[]>([]),
          { trackBy: 'id', columns: invoiceColumns },
          withA(),
          withComputed((s) => {
            // @ts-expect-error — `b` is contributed by `withB()`, composed after this block.
            void s.b;
            return { n: computed(() => s.a()) };
          }),
          withB()
        )
      );

      expectTypeOf(table.n).toEqualTypeOf<Signal<number>>();
    });

    it('case 29 — a feature composed after a withComputed() block sees its contributed member', () => {
      const table = TestBed.runInInjectionContext(() =>
        createTable(
          signal<Invoice[]>([]),
          { trackBy: 'id', columns: invoiceColumns },
          withA(),
          withComputed((s) => ({ n: computed(() => s.a()) })),
          createTableFeature((input) => {
            expectTypeOf(input.n).toEqualTypeOf<Signal<number>>();
            return {};
          })
        )
      );

      void table;
    });

    it('case 30 — withComputed() used as a trailing derive block sees its own feature’s member', () => {
      // Explicit type args: not consumed inline by a `createTable()` call, so there is no
      // contextual type for `createTableFeature` to infer `In` from.
      const withComputedDerived = createTableFeature<
        TableStore<Invoice>,
        { a: Signal<number> },
        { twice: Signal<number> }
      >(
        () => ({ members: { a: signal(1).asReadonly() } }),
        withComputed<TableStore<Invoice> & { a: Signal<number> }, { twice: Signal<number> }>(
          (s) => {
            expectTypeOf(s.a).toEqualTypeOf<Signal<number>>();
            return { twice: computed(() => s.a() * 2) };
          }
        )
      );

      expectTypeOf(withComputedDerived).toMatchTypeOf<
        Feature<TableStore<Invoice>, { a: Signal<number> } & { twice: Signal<number> }>
      >();

      const table = TestBed.runInInjectionContext(() =>
        createTable(
          signal<Invoice[]>([]),
          { trackBy: 'id', columns: invoiceColumns },
          withComputedDerived
        )
      );

      expectTypeOf(table.twice).toEqualTypeOf<Signal<number>>();
    });

    // Trap 3 at withComputed's own declaration site: the return type is a single
    // `Feature<In, D>`, not an intersection. Case 19 asserts the same of the derive helper.
    it('case 31 — trap 3: withComputed() returns one Feature, not an intersection', () => {
      const fn = (s: ReadonlyStore<TableStore<Invoice>>): { n: Signal<number> } => ({
        n: computed(() => s.totalRowCount()),
      });

      const feature = withComputed<TableStore<Invoice>, { n: Signal<number> }>(fn);

      expectTypeOf(feature).toEqualTypeOf<Feature<TableStore<Invoice>, { n: Signal<number> }>>();
      expectTypeOf(feature).not.toBeAny();
    });

    it('case 32 — a second withComputed() block reads the first block’s member, typed', () => {
      const table = TestBed.runInInjectionContext(() =>
        createTable(
          signal<Invoice[]>([]),
          { trackBy: 'id', columns: invoiceColumns },
          withA(),
          withComputed((s) => ({ n: computed(() => s.a()) })),
          withComputed((s) => {
            expectTypeOf(s.n).toEqualTypeOf<Signal<number>>();
            return { doubled: computed(() => s.n() * 2) };
          })
        )
      );

      expectTypeOf(table.doubled).toEqualTypeOf<Signal<number>>();
    });

    it('case 33 — an earlier withComputed() block reading a later block’s member is a compile error (D25)', () => {
      const earlyBlock = withComputed<
        TableStore<Invoice> & { a: Signal<number> },
        { n: Signal<number> }
      >((s) => {
        // @ts-expect-error — `later` is contributed by a withComputed() block composed after this one.
        void s.later;
        return { n: computed(() => s.a()) };
      });

      void earlyBlock;
    });

    it('case 34 — the block parameter sees core renderRows and totalRowCount signals', () => {
      const sees = withComputed<TableStore<Invoice>, { n: Signal<number> }>((s) => {
        expectTypeOf(s.renderRows).toEqualTypeOf<Signal<RenderRow<Invoice>[]>>();
        expectTypeOf(s.totalRowCount).toEqualTypeOf<Signal<number>>();
        return { n: computed(() => s.totalRowCount()) };
      });

      void sees;
    });

    // -------------------------------------------------------------------------------------
    // composeFeatures() (#37) — composite slots, nesting, the arity escape hatch, not-any.
    // Same fixtures as above; `withC` is the third contribution nesting needs.
    // -------------------------------------------------------------------------------------

    function withC(): Feature<
      TableStore<Invoice> & { a: Signal<number> } & { b(): void },
      { c: Signal<boolean> }
    > {
      return createTableFeature(() => ({ members: { c: signal(false).asReadonly() } }));
    }

    /** The case 35 composition — a composite in slot 1, a plain feature reading it in slot 2.
     * Shared with case 39, which asserts the same table is not `any`. */
    function composeCompositeTable() {
      return TestBed.runInInjectionContext(() =>
        createTable(
          signal<Invoice[]>([]),
          { trackBy: 'id', columns: invoiceColumns },
          composeFeatures(withA(), withB()),
          createTableFeature((input) => {
            expectTypeOf(input.a).toEqualTypeOf<Signal<number>>();
            expectTypeOf(input.b).toEqualTypeOf<() => void>();
            return { members: {} };
          })
        )
      );
    }

    it('case 35 — a following slot sees the composite’s full contribution', () => {
      const table = composeCompositeTable();

      expectTypeOf<keyof typeof table>().toEqualTypeOf<
        'a' | 'b' | keyof TableStore<Invoice>
      >();
    });

    it('case 36 — an inner feature sees earlier inners and the slot before the composite', () => {
      // `withB` declares `In` as `TableStore<Invoice> & { a }` — that it type-checks as inner
      // slot 1 of a composite placed *after* `withA()` is the compile assertion itself.
      const table = TestBed.runInInjectionContext(() =>
        createTable(
          signal<Invoice[]>([]),
          { trackBy: 'id', columns: invoiceColumns },
          withA(),
          composeFeatures(
            withB(),
            createTableFeature((input) => {
              expectTypeOf(input.a).toEqualTypeOf<Signal<number>>();
              expectTypeOf(input.b).toEqualTypeOf<() => void>();
              return { members: {} };
            })
          )
        )
      );

      void table;
    });

    it('case 37 — a nested composite flattens into the outer slot’s contribution', () => {
      const table = TestBed.runInInjectionContext(() =>
        createTable(
          signal<Invoice[]>([]),
          { trackBy: 'id', columns: invoiceColumns },
          composeFeatures(withA(), composeFeatures(withB(), withC())),
          createTableFeature((input) => {
            expectTypeOf(input.a).toEqualTypeOf<Signal<number>>();
            expectTypeOf(input.b).toEqualTypeOf<() => void>();
            expectTypeOf(input.c).toEqualTypeOf<Signal<boolean>>();
            return { members: {} };
          })
        )
      );

      expectTypeOf<keyof typeof table>().toEqualTypeOf<
        'a' | 'b' | 'c' | keyof TableStore<Invoice>
      >();
    });

    it('case 38 — the arity escape hatch: 15 inner features per composite, nestable', () => {
      // `{ members: {} }` contributes `{}`, not `object` — case 23 guards why that matters.
      const inert = createTableFeature((store: TableStore<Invoice>) => {
        void store;
        return { members: {} };
      });

      // (a) 15 inner features in one slot.
      const fifteen = TestBed.runInInjectionContext(() =>
        createTable(
          signal<Invoice[]>([]),
          { trackBy: 'id', columns: invoiceColumns },
          composeFeatures(
            inert, inert, inert, inert, inert,
            inert, inert, inert, inert, inert,
            inert, inert, inert, inert, inert
          )
        )
      );
      void fifteen;

      // (b) nesting escapes the cap entirely — 16 features reachable through one slot.
      const sixteen = TestBed.runInInjectionContext(() =>
        createTable(
          signal<Invoice[]>([]),
          { trackBy: 'id', columns: invoiceColumns },
          composeFeatures(
            composeFeatures(
              inert, inert, inert, inert, inert,
              inert, inert, inert, inert, inert,
              inert, inert, inert, inert, inert
            ),
            withA()
          )
        )
      );

      expectTypeOf(sixteen.a).toEqualTypeOf<Signal<number>>();

      // (c) a 16th *direct* inner argument still matches no overload (mirrors case 22).
      composeFeatures(
        inert, inert, inert, inert, inert,
        inert, inert, inert, inert, inert,
        inert, inert, inert, inert, inert,
        // @ts-expect-error — composeFeatures caps at 15 inner features, same as createTable.
        inert
      );
    });

    it('case 39 — a composed store is never widened to any', () => {
      const table = composeCompositeTable();

      expectTypeOf(table).not.toBeAny();
      expectTypeOf(table.a).not.toBeAny();
    });

    it('case 40 — a standalone composite keeps its contribution, but loses the row type', () => {
      const withStandard = composeFeatures(withA(), withB());

      const table = TestBed.runInInjectionContext(() =>
        createTable(
          signal<Invoice[]>([]),
          { trackBy: 'id', columns: invoiceColumns },
          withStandard,
          createTableFeature((input) => {
            expectTypeOf(input.a).toEqualTypeOf<Signal<number>>();
            expectTypeOf(input.b).toEqualTypeOf<() => void>();
            return { members: {} };
          })
        )
      );

      void table;

      // Known limitation (#44): declared standalone there is no contextual `In`, so
      // `withMatchFlag`'s own `In` falls back to its `Shape` constraint and `RowOf<Shape>`
      // is `unknown` — the same call inline in a slot below recovers `Invoice`.
      const standalone = composeFeatures(
        withMatchFlag((row) => {
          expectTypeOf(row).toEqualTypeOf<unknown>();
          return true;
        })
      );
      void standalone;

      const inline = TestBed.runInInjectionContext(() =>
        createTable(
          signal<Invoice[]>([]),
          { trackBy: 'id', columns: invoiceColumns },
          composeFeatures(
            withMatchFlag((row) => {
              expectTypeOf(row).toEqualTypeOf<Invoice>();
              return row.status === 'open';
            })
          )
        )
      );
      void inline;
    });

    // Trap 3 at composeFeatures' own declaration site: one `Feature` whose `Out` is the
    // intersection, not an intersection *of features*. Cases 19 and 31 assert the same of the
    // derive helper and of `withComputed()`.
    it('case 41 — trap 3: composeFeatures() returns one Feature, not an intersection', () => {
      expectTypeOf(composeFeatures(withA(), withB())).toEqualTypeOf<
        Feature<TableStore<Invoice>, { a: Signal<number> } & { b(): void }>
      >();
    });
  });
});
