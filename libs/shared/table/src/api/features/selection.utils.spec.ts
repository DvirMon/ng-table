import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { mockRows, mockTrackBy, type MockRow } from '../../table.mock';
import { createFilters } from '../create-filters';
import { createTable } from '../create-table';
import { equals } from '../filters/rules';
import { selectAllIds } from './selection.utils';
import { withFiltering } from './with-filtering';
import { withSelection } from './with-selection';
import type { AnyTableFeature, ColumnDef, TableStore } from '../types';
import type { Filters, FiltersPath } from '../filters.types';

function makeColumns(): ColumnDef<MockRow>[] {
  return [{ id: 'name', accessor: (row) => row.name, visible: true, order: 0, label: 'name' }];
}

/** Runs a `createTable()` build inside an Angular injection context. */
function inContext<T>(build: () => T): T {
  return TestBed.runInInjectionContext(build);
}

// Mirrors with-filtering.spec.ts's buildFilters — one type argument, `TState` defaulted.
function buildFilters(schema: (path: FiltersPath<MockRow>) => void): Filters<MockRow> {
  return TestBed.runInInjectionContext(() => createFilters<MockRow>(schema));
}

/**
 * `withFiltering()` (#72 pending) still takes the internal `TableCore<TRow>` engine handle
 * rather than the `Feature<In, Out>` shape `createTable`'s per-arity overloads expect — unlike
 * `withSorting()`, it doesn't structurally satisfy a slot (it needs `baseColumns`, which
 * `TableStore` doesn't have). This variadic view is the same static/dynamic seam
 * `compose-features.spec.ts` bridges for the same reason: cast once at the call boundary
 * instead of casting every feature value.
 */
type CreateTableVariadic = (
  data: WritableSignal<MockRow[]>,
  config: { trackBy: typeof mockTrackBy; columns: ColumnDef<MockRow>[] },
  ...features: AnyTableFeature[]
) => TableStore<MockRow>;

function makeFilteredStore(filters: Filters<MockRow>): TableStore<MockRow> {
  // The cast to `AnyTableFeature` (not just the call's own return type) is required: compared
  // structurally against `Feature<any, any>`, `withFiltering`'s `TableCore`-shaped stages make
  // `RowOf<any>` resolve to `unknown` rather than `any`, which then rejects the concrete
  // `MockRow` in `RowTransform<MockRow>` — an artifact of #72 not having landed, not something
  // this test can fix.
  const filtering = withFiltering<MockRow>({ filters }) as unknown as AnyTableFeature; // #72 strips the type argument
  return TestBed.runInInjectionContext(() =>
    (createTable as unknown as CreateTableVariadic)(
      signal<MockRow[]>(mockRows),
      { trackBy: mockTrackBy, columns: makeColumns() },
      filtering
    )
  );
}

describe('selectAllIds', () => {
  it("default scope selects exactly rows()'s ids, a strict subset of value()", () => {
    // Filters on `id`, not `name` — `filters` is itself callable, so `filters['name']` would
    // collide with the built-in `Function.prototype.name` property instead of the filter handle.
    const filters = buildFilters((path) => equals(path.id));
    const store = makeFilteredStore(filters);

    filters['id']().value.set(1);

    // Sanity: the filter genuinely narrows rows() below value() before asserting on it.
    expect(store.rows().map((row) => row.id)).toEqual([1]);
    expect(store.value().map((row) => row.id)).toEqual([1, 2, 3]);

    expect(selectAllIds(store)).toEqual([1]);
  });

  it("includeHidden: true selects exactly value()'s ids", () => {
    const filters = buildFilters((path) => equals(path.id));
    const store = makeFilteredStore(filters);

    filters['id']().value.set(1);

    expect(selectAllIds(store, { includeHidden: true })).toEqual([1, 2, 3]);
  });

  it("composes with pre-existing selection via select()'s own dedup (D15)", () => {
    const store = inContext(() =>
      createTable(
        signal<MockRow[]>(mockRows),
        { trackBy: mockTrackBy, columns: makeColumns() },
        withSelection()
      )
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
    const store = inContext(() =>
      createTable(signal<MockRow[]>([]), { trackBy: mockTrackBy, columns: makeColumns() })
    );

    expect(() => selectAllIds(store)).not.toThrow();
    expect(selectAllIds(store)).toEqual([]);
    expect(selectAllIds(store, { includeHidden: true })).toEqual([]);
  });
});
