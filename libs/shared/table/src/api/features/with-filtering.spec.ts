import { computed, signal, type Signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { expectTypeOf } from 'vitest';
import { createFilters } from '../../filters/create-filters';
import { createTable } from '../create-table';
import { equals } from '../../filters/rules';
import { rowOf } from '../../filters/row-of';
import { withComputed } from './with-computed';
import { withFiltering } from './with-filtering';
import type { ColumnDef, TableStore } from '../types';
import type { FiltersPath } from '../../filters/types';

interface Row {
  id: string;
  name: string;
  status: string;
  category: string;
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

// Kept only to build the filter model for the one integration case below — the filter model's own
// behavior and typing live in `create-filters.spec.ts`.
function buildFilters<S extends readonly unknown[]>(schema: (path: FiltersPath<Row>) => S) {
  return TestBed.runInInjectionContext(() => createFilters(rowOf<Row>(), schema));
}

/** Runs a `createTable()` build inside an Angular injection context. */
function inContext<T>(build: () => T): T {
  return TestBed.runInInjectionContext(build);
}

describe('withFiltering', () => {
  it('composes into createTable() with Row inferred from the data slot', () => {
    const store = inContext(() =>
      createTable(
        signal<Row[]>(makeRows()),
        { trackBy: 'id', columns: makeColumns() },
        withFiltering({ predicates: () => [(row: Row) => row.id !== 'r2'] })
      )
    );

    expect(store.rows().map((row) => row.id)).toEqual(['r1', 'r3']);
  });

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

  it('never narrows while the term list is empty', () => {
    const store = inContext(() =>
      createTable(
        signal<Row[]>(makeRows()),
        { trackBy: 'id', columns: makeColumns() },
        withFiltering({ predicates: () => [] })
      )
    );

    expect(store.rows()).toHaveLength(3);
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

  it('composes with a filter model through matcher()', () => {
    const filters = buildFilters((path) => [equals(path.status)]);
    const store = inContext(() =>
      createTable(
        signal<Row[]>(makeRows()),
        { trackBy: 'id', columns: makeColumns() },
        withFiltering({ predicates: () => [filters().matcher(), (row: Row) => row.category === 'b'] })
      )
    );

    filters.status().value.set('open');

    expect(store.rows().map((row) => row.id)).toEqual(['r3']);
  });

  // -------------------------------------------------------------------------------------
  // Type-level assertions. The vitest executor does NOT typecheck `expectTypeOf`/
  // `@ts-expect-error` — they are inert at runtime. These are only enforced by
  // `tsc -p libs/shared/table/tsconfig.spec.json --noEmit`, which is the verification step
  // for this describe block.
  // -------------------------------------------------------------------------------------
  describe('types', () => {
    it('withFiltering({ predicates }) alone contributes {} — recovered exactly as TableStore<Row>, never widened to any', () => {
      const store = inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withFiltering({ predicates: () => [(row: Row) => row.status === 'open'] })
        )
      );

      expectTypeOf(store).toEqualTypeOf<TableStore<Row>>();
      expectTypeOf(store).not.toBeAny();
    });

    it('trailing block: withComputed adds visibleCount, keyof store is TableStore<Row> | "visibleCount"', () => {
      const store = inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withFiltering(
            { predicates: () => [(row: Row) => row.status === 'open'] },
            withComputed((s) => ({ visibleCount: computed(() => s.rows().length) }))
          )
        )
      );

      expectTypeOf(store.visibleCount).toEqualTypeOf<Signal<number>>();
      expectTypeOf<keyof typeof store>().toEqualTypeOf<keyof TableStore<Row> | 'visibleCount'>();
    });
  });
});
