import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { createTable } from '../create-table';
import { withSorting } from './with-sorting';
import type {
  AnyTableFeature,
  ColumnDef,
  SortRule,
  TableStoreConfig,
} from '../types';

interface Row {
  id: string;
  name: string;
  age: number;
  joined: Date;
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
      id: 'joined',
      accessor: (row) => row.joined,
      visible: true,
      order: 2,
      label: 'joined',
      ...overrides['joined'],
    },
    {
      id: 'status',
      accessor: (row) => row.status,
      visible: true,
      order: 3,
      label: 'status',
      ...overrides['status'],
    },
  ];
}

function makeRows(): Row[] {
  return [
    { id: 'r1', name: 'Charlie', age: 40, joined: new Date('2024-03-01'), status: 'active' },
    { id: 'r2', name: 'Ann', age: 25, joined: new Date('2022-01-15'), status: 'inactive' },
    { id: 'r3', name: 'Bob', age: 30, joined: new Date('2023-06-10'), status: 'active' },
  ];
}

// Builds a live store instance inside an injection context, generic over the feature tuple
// so `store.sorting()` / `toggleSort()` stay fully typed. Rows are seeded at construction via
// the `data` signal — pass `rows` for tests that need them, omit for column/state-only tests.
function makeStore<const F extends readonly AnyTableFeature[]>(
  cfg: () => TableStoreConfig<Row, F>,
  rows: Row[] = []
) {
  return TestBed.runInInjectionContext(() => createTable(signal<Row[]>(rows), cfg));
}

describe('withSorting', () => {
  it('exposes an empty sorting array by default', () => {
    const store = makeStore(() => ({
      trackBy: 'id',
      columns: makeColumns(),
      features: [withSorting<Row>()],
    }));

    expect(store.sorting()).toEqual([]);
  });

  it('toggleSort() cycles a column ascending -> descending -> unsorted', () => {
    const store = makeStore(() => ({
      trackBy: 'id',
      columns: makeColumns(),
      features: [withSorting<Row>()],
    }));

    store.toggleSort('name');
    expect(store.sorting()).toEqual([{ columnId: 'name', direction: 'asc' }]);

    store.toggleSort('name');
    expect(store.sorting()).toEqual([{ columnId: 'name', direction: 'desc' }]);

    store.toggleSort('name');
    expect(store.sorting()).toEqual([]);
  });

  it('toggleSort() replaces the sort when a different column is clicked (default: single-column)', () => {
    const store = makeStore(() => ({
      trackBy: 'id',
      columns: makeColumns(),
      features: [withSorting<Row>()],
    }));

    store.toggleSort('status');
    expect(store.sorting()).toEqual([{ columnId: 'status', direction: 'asc' }]);

    store.toggleSort('name');
    expect(store.sorting()).toEqual([{ columnId: 'name', direction: 'asc' }]);

    // Re-clicking the same (sole) column still cycles asc -> desc -> unsorted.
    store.toggleSort('name');
    expect(store.sorting()).toEqual([{ columnId: 'name', direction: 'desc' }]);

    store.toggleSort('name');
    expect(store.sorting()).toEqual([]);
  });

  it('is additive across columns with multi: true, preserving click-order priority', () => {
    const store = makeStore(() => ({
      trackBy: 'id',
      columns: makeColumns(),
      features: [withSorting<Row>({ multi: true })],
    }));

    store.toggleSort('status');
    store.toggleSort('name');

    expect(store.sorting()).toEqual([
      { columnId: 'status', direction: 'asc' },
      { columnId: 'name', direction: 'asc' },
    ]);

    // Re-toggling an already-active column updates it in place rather than
    // moving it to the end of the priority order.
    store.toggleSort('status');
    expect(store.sorting()).toEqual([
      { columnId: 'status', direction: 'desc' },
      { columnId: 'name', direction: 'asc' },
    ]);
  });

  it('enableSorting: false makes toggleSort() a no-op for that column', () => {
    const store = makeStore(() => ({
      trackBy: 'id',
      columns: makeColumns({ status: { enableSorting: false } }),
      features: [withSorting<Row>()],
    }));

    store.toggleSort('status');

    expect(store.sorting()).toEqual([]);
  });

  it('sortDirections() derives a columnId -> direction lookup from sorting()', () => {
    const store = makeStore(() => ({
      trackBy: 'id',
      columns: makeColumns(),
      features: [withSorting<Row>({ multi: true })],
    }));

    expect(store.sortDirections()).toEqual(new Map());

    store.toggleSort('status');
    store.toggleSort('name');

    expect(store.sortDirections()).toEqual(
      new Map([
        ['status', 'asc'],
        ['name', 'asc'],
      ])
    );

    store.toggleSort('status');
    expect(store.sortDirections().get('status')).toBe('desc');
  });

  it('setSorting() and clearSorting() drive state programmatically', () => {
    const store = makeStore(() => ({
      trackBy: 'id',
      columns: makeColumns(),
      features: [withSorting<Row>()],
    }));

    const rules: SortRule[] = [{ columnId: 'age', direction: 'desc' }];
    store.setSorting(rules);
    expect(store.sorting()).toEqual(rules);

    store.clearSorting();
    expect(store.sorting()).toEqual([]);
  });

  it('sorts rendered rows using a custom sortFn when supplied', () => {
    const store = makeStore(() => ({
      trackBy: 'id',
      columns: makeColumns({
        name: { sortFn: (a, b) => b.name.localeCompare(a.name) }, // reversed
      }),
      features: [withSorting<Row>()],
    }), makeRows());

    store.toggleSort('name');

    expect(store.rows().map((row) => row.name)).toEqual([
      'Charlie',
      'Bob',
      'Ann',
    ]);
  });

  it('falls back to numeric comparison for number columns', () => {
    const store = makeStore(() => ({
      trackBy: 'id',
      columns: makeColumns(),
      features: [withSorting<Row>()],
    }), makeRows());

    store.toggleSort('age');

    expect(store.rows().map((row) => row.age)).toEqual([25, 30, 40]);
  });

  it('falls back to Date comparison for Date columns', () => {
    const store = makeStore(() => ({
      trackBy: 'id',
      columns: makeColumns(),
      features: [withSorting<Row>()],
    }), makeRows());

    store.toggleSort('joined');

    expect(store.rows().map((row) => row.id)).toEqual(['r2', 'r3', 'r1']);
  });

  it('falls back to locale string comparison for string columns', () => {
    const store = makeStore(() => ({
      trackBy: 'id',
      columns: makeColumns(),
      features: [withSorting<Row>()],
    }), makeRows());

    store.toggleSort('name');

    expect(store.rows().map((row) => row.name)).toEqual([
      'Ann',
      'Bob',
      'Charlie',
    ]);
  });

  it('applies multi-column priority order to rendered rows with multi: true', () => {
    const store = makeStore(() => ({
      trackBy: 'id',
      columns: makeColumns(),
      features: [withSorting<Row>({ multi: true })],
    }), makeRows());

    // status asc (active, active, inactive) then name asc within status
    store.toggleSort('status');
    store.toggleSort('name');

    expect(store.rows().map((row) => row.id)).toEqual(['r3', 'r1', 'r2']);
  });

  it('replaces the rendered sort with the default single-column behavior', () => {
    const store = makeStore(() => ({
      trackBy: 'id',
      columns: makeColumns(),
      features: [withSorting<Row>()],
    }), makeRows());

    // status asc would be (active, active, inactive), but clicking name
    // afterward replaces the sort entirely rather than adding a tie-break.
    store.toggleSort('status');
    store.toggleSort('name');

    expect(store.rows().map((row) => row.name)).toEqual([
      'Ann',
      'Bob',
      'Charlie',
    ]);
  });

  describe('manual mode', () => {
    it('updates sorting and fires sortChanged but skips client-side sort processing', () => {
      const rawRows = makeRows();
      const store = makeStore(() => ({
        trackBy: 'id',
        columns: makeColumns(),
        features: [withSorting<Row>({ manual: true })],
      }), rawRows);

      const emitted: SortRule[][] = [];
      store.sortChanged.subscribe((rules) => emitted.push(rules));

      store.toggleSort('name');

      expect(store.sorting()).toEqual([{ columnId: 'name', direction: 'asc' }]);
      expect(emitted).toEqual([[{ columnId: 'name', direction: 'asc' }]]);
      // Rows are unchanged — manual mode assumes server-sorted data.
      expect(store.rows()).toEqual(rawRows);
    });
  });
});
