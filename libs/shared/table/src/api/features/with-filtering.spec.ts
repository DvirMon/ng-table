import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { createFilters } from '../create-filters';
import { createTable } from '../create-table';
import { anyOf, contains, equals, filter } from '../filters/rules';
import { withFiltering } from './with-filtering';
import type { AnyTableFeature, ColumnDef, TableStoreConfig } from '../types';
import type { Filters, FiltersPath } from '../filters.types';

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

// No explicit `TState` — `WithFilteringConfig<TRow>.filters` is typed `Filters<TRow>` with
// `TState` defaulted, matching `filtering.md`'s own consumer example (`createFilters<Invoice>`,
// one type argument). A `Filters<Row, TState>` built with an explicit literal `TState` isn't
// assignable to that default-`TState` parameter type (its mapped type has no index signature).
function buildFilters(schema: (path: FiltersPath<Row>) => void): Filters<Row> {
  return TestBed.runInInjectionContext(() => createFilters<Row>(schema));
}

// Mirrors with-sorting.spec.ts's makeStore: rows are seeded at construction via the `data`
// signal — pass `rows` for tests that need them, omit for state-only tests.
function makeStore<const F extends readonly AnyTableFeature[]>(
  cfg: () => TableStoreConfig<Row, F>,
  rows: Row[] = []
) {
  return TestBed.runInInjectionContext(() => createTable(signal<Row[]>(rows), cfg));
}

describe('withFiltering', () => {
  it('composes into createTable(), TRow inferred from the enclosing config', () => {
    const filters = buildFilters((path) => equals(path.status));
    const store = makeStore(
      () => ({
        trackBy: 'id',
        columns: makeColumns(),
        features: [withFiltering({ filters })],
      }),
      makeRows()
    );

    expect(store.rows()).toHaveLength(3);
  });

  it('narrows rows() to those matching an active filter', () => {
    const filters = buildFilters((path) => equals(path.status));
    const store = makeStore(
      () => ({
        trackBy: 'id',
        columns: makeColumns(),
        features: [withFiltering({ filters })],
      }),
      makeRows()
    );

    filters['status']().value.set('open');

    expect(store.rows().map((row) => row.id)).toEqual(['r1', 'r3']);
  });

  it('combines separate filters with AND', () => {
    const filters = buildFilters((path) => {
      equals(path.status);
      equals(path.category);
    });
    const store = makeStore(
      () => ({
        trackBy: 'id',
        columns: makeColumns(),
        features: [withFiltering({ filters })],
      }),
      makeRows()
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
    const store = makeStore(
      () => ({
        trackBy: 'id',
        columns: makeColumns(),
        features: [withFiltering({ filters })],
      }),
      makeRows()
    );

    filters['search']().value.set('b');

    expect(store.rows().map((row) => row.id).sort()).toEqual(['r2', 'r3']);
  });

  it('never narrows while every criterion is empty', () => {
    const filters = buildFilters((path) => {
      equals(path.status);
      equals(path.category);
    });
    const store = makeStore(
      () => ({
        trackBy: 'id',
        columns: makeColumns(),
        features: [withFiltering({ filters })],
      }),
      makeRows()
    );

    expect(store.rows()).toHaveLength(3);
  });

  it('contributes no members beyond the core store surface', () => {
    const filters = buildFilters((path) => equals(path.status));
    const store = makeStore(() => ({
      trackBy: 'id',
      columns: makeColumns(),
      features: [withFiltering({ filters })],
    }));

    expect('filters' in store).toBe(false);
    expect('setColumnFilter' in store).toBe(false);
  });

  describe('manual mode', () => {
    it('skips the client-side filter stage while filters() state keeps updating', () => {
      const filters = buildFilters((path) => equals(path.status));
      const rawRows = makeRows();
      const store = makeStore(
        () => ({
          trackBy: 'id',
          columns: makeColumns(),
          features: [withFiltering({ filters, manual: true })],
        }),
        rawRows
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

        const store = makeStore(
          () => ({
            trackBy: 'id',
            columns: makeColumns(),
            features: [withFiltering({ filters })],
          }),
          makeRows()
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
});
