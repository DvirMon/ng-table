import { computed, signal, type Signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { expectTypeOf } from 'vitest';
import { createFilters } from '../create-filters';
import { createTable } from '../create-table';
import { anyOf, contains, equals, filter } from '../filters/rules';
import { withComputed } from './with-computed';
import { withFiltering } from './with-filtering';
import type { ColumnDef, TableStore } from '../types';
import type { Filters, FiltersPath } from '../filters.types';

interface Row {
  id: string;
  name: string;
  status: string;
  category: string;
}

interface OtherRow {
  id: string;
  label: string;
}

function makeColumns(): ColumnDef<Row>[] {
  return [
    { id: 'name', accessor: (row) => row.name, visible: true, order: 0, label: 'name' },
    { id: 'status', accessor: (row) => row.status, visible: true, order: 1, label: 'status' },
    { id: 'category', accessor: (row) => row.category, visible: true, order: 2, label: 'category' },
  ];
}

function makeRows(): Row[] {
  return [
    { id: 'r1', name: 'Ann', status: 'open', category: 'a' },
    { id: 'r2', name: 'Bob', status: 'closed', category: 'b' },
    { id: 'r3', name: 'Cid', status: 'open', category: 'b' },
  ];
}

// No explicit `TState`, exercising the default-`TState` path: criteria come back as
// `FilterNode<unknown>` and are reached by bracket access, because a mapped type over
// `Record<string, unknown>` is an index signature. The typed path — `createFilters<Row, TState>()`
// composed into `withFiltering()`, property access, criteria typed — is covered in
// "withFiltering — a concretely-typed Filters" below.
function buildFilters(schema: (path: FiltersPath<Row>) => void): Filters<Row> {
  return TestBed.runInInjectionContext(() => createFilters<Row>(schema));
}

function buildOtherFilters(schema: (path: FiltersPath<OtherRow>) => void): Filters<OtherRow> {
  return TestBed.runInInjectionContext(() => createFilters<OtherRow>(schema));
}

/** Runs a `createTable()` build inside an Angular injection context. */
function inContext<T>(build: () => T): T {
  return TestBed.runInInjectionContext(build);
}

describe('withFiltering', () => {
  it('composes into createTable(), Row inferred from the data slot', () => {
    const filters = buildFilters((path) => equals(path.status));
    const store = inContext(() =>
      createTable(
        signal<Row[]>(makeRows()),
        { trackBy: 'id', columns: makeColumns() },
        withFiltering({ filters })
      )
    );

    expect(store.rows()).toHaveLength(3);
  });

  it('narrows rows() to those matching an active filter', () => {
    const filters = buildFilters((path) => equals(path.status));
    const store = inContext(() =>
      createTable(
        signal<Row[]>(makeRows()),
        { trackBy: 'id', columns: makeColumns() },
        withFiltering({ filters })
      )
    );

    filters['status']().value.set('open');

    expect(store.rows().map((row) => row.id)).toEqual(['r1', 'r3']);
  });

  it('combines separate filters with AND', () => {
    const filters = buildFilters((path) => {
      equals(path.status);
      equals(path.category);
    });
    const store = inContext(() =>
      createTable(
        signal<Row[]>(makeRows()),
        { trackBy: 'id', columns: makeColumns() },
        withFiltering({ filters })
      )
    );

    filters['status']().value.set('open');
    filters['category']().value.set('b');

    expect(store.rows().map((row) => row.id)).toEqual(['r3']);
  });

  it('ORs sibling predicates within one anyOf group', () => {
    const filters = buildFilters((path) => {
      anyOf<Row>('search', (p) => {
        contains(p.name);
        contains(p.category);
      });
    });
    const store = inContext(() =>
      createTable(
        signal<Row[]>(makeRows()),
        { trackBy: 'id', columns: makeColumns() },
        withFiltering({ filters })
      )
    );

    filters['search']().value.set('b');

    expect(store.rows().map((row) => row.id).sort()).toEqual(['r2', 'r3']);
  });

  it('never narrows while every criterion is empty', () => {
    const filters = buildFilters((path) => {
      equals(path.status);
      equals(path.category);
    });
    const store = inContext(() =>
      createTable(
        signal<Row[]>(makeRows()),
        { trackBy: 'id', columns: makeColumns() },
        withFiltering({ filters })
      )
    );

    expect(store.rows()).toHaveLength(3);
  });

  it('contributes no members beyond the core store surface', () => {
    const filters = buildFilters((path) => equals(path.status));
    const store = inContext(() =>
      createTable(
        signal<Row[]>([]),
        { trackBy: 'id', columns: makeColumns() },
        withFiltering({ filters })
      )
    );

    expect('filters' in store).toBe(false);
    expect('setColumnFilter' in store).toBe(false);
  });

  describe('manual mode', () => {
    it('skips the client-side filter stage while filters() state keeps updating', () => {
      const filters = buildFilters((path) => equals(path.status));
      const rawRows = makeRows();
      const store = inContext(() =>
        createTable(
          signal<Row[]>(rawRows),
          { trackBy: 'id', columns: makeColumns() },
          withFiltering({ filters, manual: true })
        )
      );

      filters['status']().value.set('open');

      expect(store.rows()).toEqual(rawRows);
      expect(filters().active()).toEqual({ status: 'open' });
      expect(filters().dirty()).toBe(true);
    });
  });

  describe('errors', () => {
    it('a throwing predicate deactivates only that filter, without taking the table down', () => {
      const reportSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      try {
        const filters = buildFilters((path) => {
          filter<Row, 'status', string | null>(
            path.status,
            () => {
              throw new Error('boom');
            },
            { isEmpty: (v) => v == null, emptyValue: null }
          );
          equals(path.category);
        });

        const store = inContext(() =>
          createTable(
            signal<Row[]>(makeRows()),
            { trackBy: 'id', columns: makeColumns() },
            withFiltering({ filters })
          )
        );

        filters['status']().value.set('open'); // activates the throwing filter
        filters['category']().value.set('b');

        expect(() => store.rows()).not.toThrow();
        // status's predicate throws and is skipped for this evaluation; category still narrows.
        expect(store.rows().map((row) => row.id)).toEqual(['r2', 'r3']);
        expect(reportSpy).toHaveBeenCalled();
      } finally {
        reportSpy.mockRestore();
      }
    });
  });

  it('the trailing block sees post-filter rows: visibleCount reflects the narrowed set', () => {
    const filters = buildFilters((path) => equals(path.status));
    const store = inContext(() =>
      createTable(
        signal<Row[]>(makeRows()),
        { trackBy: 'id', columns: makeColumns() },
        withFiltering(
          { filters },
          withComputed((s) => ({ visibleCount: computed(() => s.rows().length) }))
        )
      )
    );

    filters['status']().value.set('open');
    expect(store.visibleCount()).toBe(2);

    filters['status']().reset();
    expect(store.visibleCount()).toBe(3);
  });

  describe('a predicate list', () => {
    it('narrows rows() with a plain predicate and no filter model at all', () => {
      const store = inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withFiltering({ predicates: () => [(row: Row) => row.status === 'open'] })
        )
      );

      expect(store.rows().map((row) => row.id)).toEqual(['r1', 'r3']);
    });

    it('combines separate predicate terms with AND', () => {
      const store = inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withFiltering({
            predicates: () => [
              (row: Row) => row.status === 'open',
              (row: Row) => row.category === 'b',
            ],
          })
        )
      );

      expect(store.rows().map((row) => row.id)).toEqual(['r3']);
    });

    it('recomputes the list when a signal read inside the thunk changes', () => {
      const wantedStatus = signal('open');
      const store = inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withFiltering({
            predicates: () => {
              const status = wantedStatus();
              return [(row: Row) => row.status === status];
            },
          })
        )
      );

      expect(store.rows().map((row) => row.id)).toEqual(['r1', 'r3']);

      wantedStatus.set('closed');

      expect(store.rows().map((row) => row.id)).toEqual(['r2']);
    });

    it('calls the thunk once per pass, not once per row', () => {
      const listTerms = vi.fn(() => [(row: Row) => row.status === 'open']);
      const store = inContext(() =>
        createTable(
          signal<Row[]>(makeRows()), // 3 rows: a per-row call would be 3
          { trackBy: 'id', columns: makeColumns() },
          withFiltering({ predicates: listTerms })
        )
      );

      expect(store.rows()).toHaveLength(2);
      expect(listTerms).toHaveBeenCalledTimes(1);
    });

    it('contributes no members beyond the core store surface', () => {
      const store = inContext(() =>
        createTable(
          signal<Row[]>([]),
          { trackBy: 'id', columns: makeColumns() },
          withFiltering({ predicates: () => [] })
        )
      );

      expect('predicates' in store).toBe(false);
      expect('filters' in store).toBe(false);
    });

    it('the trailing block sees post-predicate rows: visibleCount reflects the narrowed set', () => {
      const wantedStatus = signal('open');
      const store = inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withFiltering(
            {
              predicates: () => {
                const status = wantedStatus();
                return [(row: Row) => row.status === status];
              },
            },
            withComputed((s) => ({ visibleCount: computed(() => s.rows().length) }))
          )
        )
      );

      expect(store.visibleCount()).toBe(2);

      wantedStatus.set('closed');
      expect(store.visibleCount()).toBe(1);
    });

    it('ANDs the filter model with the predicate terms when both are supplied', () => {
      const filters = buildFilters((path) => equals(path.status));
      const store = inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withFiltering({ filters, predicates: () => [(row: Row) => row.category === 'b'] })
        )
      );

      filters['status']().value.set('open');

      expect(store.rows().map((row) => row.id)).toEqual(['r3']);
    });

    describe('manual mode', () => {
      it('skips the stage without ever calling the predicate thunk', () => {
        const listTerms = vi.fn(() => [(row: Row) => row.status === 'open']);
        const rawRows = makeRows();
        const store = inContext(() =>
          createTable(
            signal<Row[]>(rawRows),
            { trackBy: 'id', columns: makeColumns() },
            withFiltering({ predicates: listTerms, manual: true })
          )
        );

        expect(store.rows()).toEqual(rawRows);
        expect(listTerms).not.toHaveBeenCalled();
      });
    });

    describe('errors', () => {
      it('drops a throwing term for the pass while its sibling keeps narrowing', () => {
        const reportSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        try {
          const store = inContext(() =>
            createTable(
              signal<Row[]>(makeRows()),
              { trackBy: 'id', columns: makeColumns() },
              withFiltering({
                predicates: () => [
                  () => {
                    throw new Error('boom');
                  },
                  (row: Row) => row.category === 'b',
                ],
              })
            )
          );

          // Not a widening to all 3 rows — the surviving term still narrows.
          expect(store.rows().map((row) => row.id)).toEqual(['r2', 'r3']);
          expect(reportSpy).toHaveBeenCalledTimes(1);
          expect(reportSpy.mock.calls[0][0]).toContain('index 0');
        } finally {
          reportSpy.mockRestore();
        }
      });

      // ADR-0014 wraps per term, not per row: a term that throws part-way must apply to no row
      // at all, rather than keeping the narrowing it managed before the throw.
      it('drops a term throwing on a later row from the whole pass, not just the rows after it', () => {
        const reportSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        try {
          const store = inContext(() =>
            createTable(
              signal<Row[]>(makeRows()),
              { trackBy: 'id', columns: makeColumns() },
              withFiltering({
                predicates: () => [
                  (row: Row) => {
                    if (row.id === 'r3') {
                      throw new Error('boom');
                    }
                    return row.status === 'open';
                  },
                ],
              })
            )
          );

          // A per-row catch would keep r1 (tested before the throw) and r3 (skipped after it),
          // excluding only r2 — an order-dependent result set.
          expect(store.rows().map((row) => row.id)).toEqual(['r1', 'r2', 'r3']);
          expect(reportSpy).toHaveBeenCalledTimes(1);
        } finally {
          reportSpy.mockRestore();
        }
      });
    });
  });

  // -------------------------------------------------------------------------------------
  // Type-level assertions. The vitest executor does NOT typecheck `expectTypeOf`/
  // `@ts-expect-error` — they are inert at runtime. These are only enforced by
  // `tsc -p libs/shared/table/tsconfig.spec.json --noEmit`, which is the verification step
  // for this describe block.
  // -------------------------------------------------------------------------------------
  describe('types', () => {
    it('withFiltering({ filters }) alone contributes {} — recovered exactly as TableStore<Row>, never widened to any', () => {
      const filters = buildFilters((path) => equals(path.status));
      const store = inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withFiltering({ filters })
        )
      );

      expectTypeOf(store).toEqualTypeOf<TableStore<Row>>();
      expectTypeOf(store).not.toBeAny();
    });

    // `FiltersRoot<TRow, TState>.matcher()` returns `(row: TRow) => boolean`, so `TRow` now sits
    // in a real position — `Filters<OtherRow>` no longer satisfies `WithFilteringConfig<Row>`.
    it('filters: TRow is consumed — a Filters<OtherRow> is rejected', () => {
      const otherFilters = buildOtherFilters((path) => equals(path.label));

      const store = inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          // @ts-expect-error — a matcher over OtherRow cannot stand in for one over Row.
          withFiltering({ filters: otherFilters })
        )
      );

      expectTypeOf(store).toEqualTypeOf<TableStore<Row>>();
    });

    it('either input alone is accepted', () => {
      const filters = buildFilters((path) => equals(path.status));

      const byFilters = inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withFiltering({ filters })
        )
      );
      const byPredicates = inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withFiltering({ predicates: () => [(row: Row) => row.status === 'open'] })
        )
      );

      expectTypeOf(byFilters).toEqualTypeOf<TableStore<Row>>();
      expectTypeOf(byPredicates).toEqualTypeOf<TableStore<Row>>();
    });

    it('trailing block: withComputed adds visibleCount, keyof store is TableStore<Row> | "visibleCount"', () => {
      const filters = buildFilters((path) => equals(path.status));
      const store = inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withFiltering(
            { filters },
            withComputed((s) => ({ visibleCount: computed(() => s.rows().length) }))
          )
        )
      );

      expectTypeOf(store.visibleCount).toEqualTypeOf<Signal<number>>();
      expectTypeOf<keyof typeof store>().toEqualTypeOf<keyof TableStore<Row> | 'visibleCount'>();
    });
  });

  /**
   * `WithFilteringConfig<TRow, TState>` carries `TState` so a concretely-keyed filter set stays
   * typed at the call site. Pinning the config to the default would force a consumer who declared
   * `createFilters<Row, TState>()` back to `unknown` criteria — `Filters<Row, TState>` is not
   * assignable to `Filters<Row>`, because `FilterNode<T>` holds an invariant `WritableSignal<T>`.
   *
   * That widening is what the first pass at the filtering stories actually did, inventing a
   * criterion façade to recover the types the declaration already had.
   */
  describe('a concretely-typed Filters', () => {
    type RowFilterState = {
      status: string | null;
      category: string | null;
    };

    function buildTypedFilters(): Filters<Row, RowFilterState> {
      return TestBed.runInInjectionContext(() =>
        createFilters<Row, RowFilterState>((path) => {
          equals(path.status);
          equals(path.category);
        })
      );
    }

    it('composes into withFiltering() without widening back to the default TState', () => {
      const filters = buildTypedFilters();
      const store = inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withFiltering({ filters })
        )
      );

      filters.status().value.set('open');

      expect(store.rows().map((row) => row.id)).toEqual(['r1', 'r3']);
    });

    it('keeps criteria typed, reached by property access rather than a bracket', () => {
      const filters = buildTypedFilters();

      expectTypeOf(filters.status().value()).toEqualTypeOf<string | null>();
      expectTypeOf(filters().value()).toEqualTypeOf<RowFilterState>();
      expectTypeOf(filters().active()).toEqualTypeOf<Partial<RowFilterState>>();
    });
  });
});
