import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { createTable } from '../create-table';
import { withFiltering, type FilteringState } from './with-filtering';
import type { AnyTableFeature, ColumnDef, FilterRule, TableStoreConfig } from '../types';

interface Row {
  id: string;
  name: string;
  age: number;
  status: string;
}

function makeColumns(
  overrides: Partial<Record<string, Partial<ColumnDef<Row>>>> = {}
): ColumnDef<Row>[] {
  return [
    {
      id: 'name',
      accessor: (row) => row.name,
      visible: true,
      order: 0,
      label: 'name',
      ...overrides['name'],
    },
    {
      id: 'age',
      accessor: (row) => row.age,
      visible: true,
      order: 1,
      label: 'age',
      ...overrides['age'],
    },
    {
      id: 'status',
      accessor: (row) => row.status,
      visible: true,
      order: 2,
      label: 'status',
      ...overrides['status'],
    },
  ];
}

function makeRows(): Row[] {
  return [
    { id: 'r1', name: 'Charlie', age: 40, status: 'active' },
    { id: 'r2', name: 'Ann', age: 25, status: 'inactive' },
    { id: 'r3', name: 'Bob', age: 30, status: 'active' },
  ];
}

function makeStore<const F extends readonly AnyTableFeature[]>(
  cfg: () => TableStoreConfig<Row, F>,
  rows: Row[] = []
) {
  return TestBed.runInInjectionContext(() => createTable(signal<Row[]>(rows), cfg));
}

describe('withFiltering', () => {
  it('exposes empty filter state by default', () => {
    const store = makeStore(() => ({
      trackBy: 'id',
      columns: makeColumns(),
      features: [withFiltering<Row>()],
    }));

    expect(store.columnFilters()).toEqual([]);
    expect(store.globalFilter()).toBe('');
  });

  it('setColumnFilter() applies a custom filterFn', () => {
    const store = makeStore(
      () => ({
        trackBy: 'id',
        columns: makeColumns({
          status: { filterFn: (value, filterValue) => value === filterValue },
        }),
        features: [withFiltering<Row>()],
      }),
      makeRows()
    );

    store.setColumnFilter('status', 'active');

    expect(store.rows().map((row) => row.id)).toEqual(['r1', 'r3']);
  });

  it('falls back to case-insensitive string-contains when a string column has no filterFn (D3)', () => {
    const store = makeStore(
      () => ({
        trackBy: 'id',
        columns: makeColumns(),
        features: [withFiltering<Row>()],
      }),
      makeRows()
    );

    store.setColumnFilter('name', 'AR');

    expect(store.rows().map((row) => row.id)).toEqual(['r1']); // "Charlie"
  });

  it('falls back to strict equality when a non-string column has no filterFn (D3)', () => {
    const store = makeStore(
      () => ({
        trackBy: 'id',
        columns: makeColumns(),
        features: [withFiltering<Row>()],
      }),
      makeRows()
    );

    store.setColumnFilter('age', 30);

    expect(store.rows().map((row) => row.id)).toEqual(['r3']);
  });

  it('clearColumnFilter() removes one column filter', () => {
    const store = makeStore(
      () => ({
        trackBy: 'id',
        columns: makeColumns(),
        features: [withFiltering<Row>()],
      }),
      makeRows()
    );

    store.setColumnFilter('status', 'active');
    store.clearColumnFilter('status');

    expect(store.columnFilters()).toEqual([]);
    expect(store.rows().map((row) => row.id)).toEqual(['r1', 'r2', 'r3']);
  });

  it('multiple column filters combine with AND', () => {
    const store = makeStore(
      () => ({
        trackBy: 'id',
        columns: makeColumns(),
        features: [withFiltering<Row>()],
      }),
      makeRows()
    );

    store.setColumnFilter('status', 'active');
    store.setColumnFilter('age', 30);

    expect(store.rows().map((row) => row.id)).toEqual(['r3']);
  });

  it('setGlobalFilter() matches case-insensitively across every column', () => {
    const store = makeStore(
      () => ({
        trackBy: 'id',
        columns: makeColumns(),
        features: [withFiltering<Row>()],
      }),
      makeRows()
    );

    store.setGlobalFilter('bob');

    expect(store.rows().map((row) => row.id)).toEqual(['r3']);
  });

  it('column filters and the global filter AND together', () => {
    const store = makeStore(
      () => ({
        trackBy: 'id',
        columns: makeColumns(),
        features: [withFiltering<Row>()],
      }),
      makeRows()
    );

    store.setColumnFilter('status', 'active');
    store.setGlobalFilter('bob');

    expect(store.rows().map((row) => row.id)).toEqual(['r3']);
  });

  it('enableFiltering: false skips a column for both column and global matching', () => {
    const store = makeStore(
      () => ({
        trackBy: 'id',
        columns: makeColumns({ status: { enableFiltering: false } }),
        features: [withFiltering<Row>()],
      }),
      makeRows()
    );

    // Column filter on an opted-out column is skipped -> no rows excluded by it.
    store.setColumnFilter('status', 'active');
    expect(store.rows().map((row) => row.id)).toEqual(['r1', 'r2', 'r3']);

    store.clearColumnFilter('status');

    // Global filter also skips the opted-out column's values.
    store.setGlobalFilter('active');
    expect(store.rows()).toEqual([]);
  });

  it('clearFilters() clears both column filters and the global filter', () => {
    const store = makeStore(
      () => ({
        trackBy: 'id',
        columns: makeColumns(),
        features: [withFiltering<Row>()],
      }),
      makeRows()
    );

    store.setColumnFilter('status', 'active');
    store.setGlobalFilter('bob');
    store.clearFilters();

    expect(store.columnFilters()).toEqual([]);
    expect(store.globalFilter()).toBe('');
    expect(store.rows().map((row) => row.id)).toEqual(['r1', 'r2', 'r3']);
  });

  it('filterChanged fires with the current filter state on every setter call', () => {
    const store = makeStore(
      () => ({
        trackBy: 'id',
        columns: makeColumns(),
        features: [withFiltering<Row>()],
      }),
      makeRows()
    );

    const emitted: FilteringState[] = [];
    store.filterChanged.subscribe((state) => emitted.push(state));

    store.setColumnFilter('status', 'active');
    store.setGlobalFilter('bob');

    const expectedColumnFilters: FilterRule[] = [{ columnId: 'status', value: 'active' }];
    expect(emitted).toEqual([
      { columnFilters: expectedColumnFilters, globalFilter: '' },
      { columnFilters: expectedColumnFilters, globalFilter: 'bob' },
    ]);
  });

  describe('manual mode', () => {
    it('updates filter state and fires filterChanged but skips client-side filtering', () => {
      const rawRows = makeRows();
      const store = makeStore(
        () => ({
          trackBy: 'id',
          columns: makeColumns(),
          features: [withFiltering<Row>({ manual: true })],
        }),
        rawRows
      );

      const emitted: FilteringState[] = [];
      store.filterChanged.subscribe((state) => emitted.push(state));

      store.setColumnFilter('status', 'active');

      expect(store.columnFilters()).toEqual([{ columnId: 'status', value: 'active' }]);
      expect(emitted.length).toBe(1);
      // Rows are unchanged — manual mode assumes server-filtered data.
      expect(store.rows()).toEqual(rawRows);
    });
  });
});
