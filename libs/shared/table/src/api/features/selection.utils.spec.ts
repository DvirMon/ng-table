import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { mockRows, mockTrackBy, type MockRow } from '../../table.mock';
import { createFilters } from '../create-filters';
import { createTable } from '../create-table';
import { equals } from '../filters/rules';
import { selectAllIds } from './selection.utils';
import { withFiltering } from './with-filtering';
import { withSelection } from './with-selection';
import type {
  AnyTableFeature,
  ColumnDef,
  ComposedFeatureMembers,
  TableStore,
  TableStoreConfig,
} from '../types';
import type { Filters, FiltersPath } from '../filters.types';

function makeColumns(): ColumnDef<MockRow>[] {
  return [{ id: 'name', accessor: (row) => row.name, visible: true, order: 0, label: 'name' }];
}

// Mirrors with-filtering.spec.ts's buildFilters — one type argument, `TState` defaulted.
function buildFilters(schema: (path: FiltersPath<MockRow>) => void): Filters<MockRow> {
  return TestBed.runInInjectionContext(() => createFilters<MockRow>(schema));
}

// Mirrors with-filtering.spec.ts / with-selection.spec.ts's makeStore: rows are seeded at
// construction via the `data` signal — pass `rows` for tests that need them, omit for state-only.
function makeStore<const F extends readonly AnyTableFeature[]>(
  cfg: () => TableStoreConfig<MockRow, F>,
  rows: MockRow[] = []
): TableStore<MockRow> & ComposedFeatureMembers<F> {
  return TestBed.runInInjectionContext(() => createTable(signal<MockRow[]>(rows), cfg));
}

describe('selectAllIds', () => {
  it("default scope selects exactly rows()'s ids, a strict subset of value()", () => {
    // Filters on `id`, not `name` — `filters` is itself callable, so `filters['name']` would
    // collide with the built-in `Function.prototype.name` property instead of the filter handle.
    const filters = buildFilters((path) => equals(path.id));
    const store = makeStore(
      () => ({
        trackBy: mockTrackBy,
        columns: makeColumns(),
        features: [withFiltering({ filters })],
      }),
      mockRows
    );

    filters['id']().value.set(1);

    // Sanity: the filter genuinely narrows rows() below value() before asserting on it.
    expect(store.rows().map((row) => row.id)).toEqual([1]);
    expect(store.value().map((row) => row.id)).toEqual([1, 2, 3]);

    expect(selectAllIds(store)).toEqual([1]);
  });

  it("includeHidden: true selects exactly value()'s ids", () => {
    const filters = buildFilters((path) => equals(path.id));
    const store = makeStore(
      () => ({
        trackBy: mockTrackBy,
        columns: makeColumns(),
        features: [withFiltering({ filters })],
      }),
      mockRows
    );

    filters['id']().value.set(1);

    expect(selectAllIds(store, { includeHidden: true })).toEqual([1, 2, 3]);
  });

  it("composes with pre-existing selection via select()'s own dedup (D15)", () => {
    const store = makeStore(
      () => ({
        trackBy: mockTrackBy,
        columns: makeColumns(),
        features: [withSelection<MockRow>()],
      }),
      mockRows
    );

    store.select([1]);
    store.select(selectAllIds(store));
    // A repeat call with the same output must not grow or corrupt the set — proves
    // selectAllIds() leans on select()'s own dedup rather than re-implementing it.
    store.select(selectAllIds(store));

    expect([...store.selectedRows()].sort()).toEqual([1, 2, 3]);

    // Same output also works as the "deselect all visible" toggle half.
    store.deselect(selectAllIds(store));

    expect(store.selectedRows().size).toBe(0);
  });

  it('returns [] for an empty row set, both default and includeHidden, without throwing', () => {
    const store = makeStore(
      () => ({
        trackBy: mockTrackBy,
        columns: makeColumns(),
        features: [],
      }),
      []
    );

    expect(() => selectAllIds(store)).not.toThrow();
    expect(selectAllIds(store)).toEqual([]);
    expect(selectAllIds(store, { includeHidden: true })).toEqual([]);
  });
});
