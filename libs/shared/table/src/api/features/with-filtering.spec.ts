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

// No explicit `TState` — `WithFilteringConfig<TRow>.filters` is typed `Filters<TRow>` with
// `TState` defaulted, matching `filtering.md`'s own consumer example (`createFilters<Invoice>`,
// one type argument). A `Filters<Row, TState>` built with an explicit literal `TState` isn't
// assignable to that default-`TState` parameter type (its mapped type has no index signature).
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

    // `Filters<TRow, TState>` (filters.types.ts) never references `TRow` in its body, so
    // `Filters<Row>` and `Filters<OtherRow>` are the same type once `TState` defaults match.
    // `WithFilteringConfig.filters` therefore carries no compile-time row correlation.
    it('filters: TRow is phantom — a Filters<OtherRow> is not rejected', () => {
      const otherFilters = buildOtherFilters((path) => equals(path.label));

      const store = inContext(() =>
        createTable(
          signal<Row[]>(makeRows()),
          { trackBy: 'id', columns: makeColumns() },
          withFiltering({ filters: otherFilters })
        )
      );

      expectTypeOf(store).toEqualTypeOf<TableStore<Row>>();
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
});
