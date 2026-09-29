import { computed, signal } from '@angular/core';

import type { RowEditMembers } from './api/features/with-row-edit';
import { createDraftRows } from './api/features/editing/draft-rows';
import {
  pendingIds,
  pendingOps,
  type EditingState,
  type EditingUpdater,
} from './api/features/editing/state';
import type { ColumnDef, RenderRow, RowId, RowUpdater, TableStore, TrackByFn } from './api/types';
import { createWritableView } from './engine/writable-view';

/** Minimal `TableStore<unknown>` stub for directive DI-wiring tests — no real store behavior. */
export function createMockTableStore(): TableStore<unknown> {
  return {
    columns: createWritableView<ColumnDef<unknown>[], never>(() => [], () => undefined),
    rows: signal<unknown[]>([]),
    renderRows: signal<RenderRow<unknown>[]>([]),
    renderColumns: signal<ColumnDef<unknown>[]>([]),
    totalRowCount: signal(0),
    trackBy: () => 'stub-id',
    indexById: signal(new Map<RowId, number>()),
    value: createWritableView<unknown[], never>(() => [], () => undefined),
  };
}

export function mockDataRenderRow(overrides: Partial<RenderRow<unknown>> = {}): RenderRow<unknown> {
  return {
    id: 'row-1',
    depth: 0,
    kind: 'row',
    data: { name: 'Ada' },
    index: 0,
    cells: {},
    ...overrides,
  };
}

export function mockGroupRenderRow(overrides: Partial<RenderRow<unknown>> = {}): RenderRow<unknown> {
  return {
    id: 'group-1',
    depth: 1,
    kind: 'group',
    data: null,
    index: 0,
    cells: {},
    ...overrides,
  };
}

export interface MockRow {
  id: number;
  name: string;
}

/** Row fixture for row-mutation / pipeline logic tests. */
export const mockRows: MockRow[] = [
  { id: 1, name: 'Ada' },
  { id: 2, name: 'Bea' },
  { id: 3, name: 'Cid' },
];

export const mockTrackBy: TrackByFn<MockRow> = (row) => row.id;

/** `count` distinct `MockRow`s, ids `0…count-1` — sized fixtures for benchmarks. */
export function createMockRows(count: number): MockRow[] {
  return Array.from({ length: count }, (_, index) => ({ id: index, name: `Row ${index}` }));
}

export interface GroupingMockRow {
  id: number;
  region: string;
  category: string;
  amount: number;
}

/** Fixture with unequal (region, category) cluster sizes, for depth-correctness aggregate
 *  checks. */
// `US > Electronics` has 2 rows, every other leaf has 1, so a parent average computed from
// children's averages (125) differs from the true leaf-level average (150) for `region: 'US'`.
export const mockGroupingRows: GroupingMockRow[] = [
  { id: 1, region: 'US', category: 'Electronics', amount: 100 },
  { id: 2, region: 'US', category: 'Electronics', amount: 300 },
  { id: 3, region: 'US', category: 'Furniture', amount: 50 },
  { id: 4, region: 'EU', category: 'Electronics', amount: 20 },
  { id: 5, region: 'EU', category: 'Furniture', amount: 10 },
  { id: 6, region: 'EU', category: 'Furniture', amount: 90 },
];

export const mockGroupingTrackBy: TrackByFn<GroupingMockRow> = (row) => row.id;

export interface GroupWhenMockRow {
  id: number;
  region: string | null | undefined;
  amount: number;
}

/** Mixed-region fixture covering both JS "blank" values (`null` and `undefined`) in one set,
 *  for `withGrouping()`'s `when`-predicate tests. */
// Two US rows, one EU, one `null` region, one `undefined` region.
export const mockGroupWhenRows: GroupWhenMockRow[] = [
  { id: 1, region: 'US', amount: 100 },
  { id: 2, region: 'US', amount: 300 },
  { id: 3, region: 'EU', amount: 50 },
  { id: 4, region: null, amount: 10 },
  { id: 5, region: undefined, amount: 20 },
];

export const mockGroupWhenTrackBy: TrackByFn<GroupWhenMockRow> = (row) => row.id;

export interface RepMockRow {
  id: number;
  region: string | null;
  rep: string;
}

/** Two-level (region -> rep) fixture for `withGrouping()`'s `when`-predicate tests. */
// A null-region row must escape the tree entirely, not re-cluster under a `rep` header (Q1).
export const mockRepRows: RepMockRow[] = [
  { id: 1, region: 'US', rep: 'Alice' },
  { id: 2, region: 'US', rep: 'Bob' },
  { id: 3, region: null, rep: 'Carol' },
];

export const mockRepTrackBy: TrackByFn<RepMockRow> = (row) => row.id;

// Mirrors `engine/core.ts`'s `indexById` derivation for the mock stores below, which don't
// compose the real engine and build the map by hand off their own `data` signal.
function mockIndexById<TRow>(rows: TRow[], trackBy: TrackByFn<TRow>): ReadonlyMap<RowId, number> {
  const map = new Map<RowId, number>();
  rows.forEach((row, index) => map.set(trackBy(row), index));
  return map;
}

// See docs/decisions/row-editing.md for the updater-through-`value` contract.
/**
 * Minimal store stub carrying a real writable `value` view, for testing updater factories
 * through `table.value.update(...)` — not a full `composeTable()` instance.
 */
export function createMockTableStoreWithData<TRow>(
  rows: TRow[],
  trackBy: TrackByFn<TRow>
): TableStore<TRow> {
  const data = signal<TRow[]>(rows);
  const indexById = computed(() => mockIndexById(data(), trackBy));
  return {
    columns: createWritableView<ColumnDef<TRow>[], never>(() => [], () => undefined),
    rows: signal<TRow[]>(rows),
    renderRows: signal<RenderRow<TRow>[]>([]),
    renderColumns: signal<ColumnDef<TRow>[]>([]),
    totalRowCount: signal(rows.length),
    indexById,
    trackBy,
    value: createWritableView<TRow[], RowUpdater<TRow>>(
      () => data(),
      (updater) => data.update((current) => updater(current, { trackBy, indexById: indexById() }))
    ),
  };
}

/**
 * Minimal store stub carrying a writable `value` view plus a standalone `editing` view (not
 * wired through `withRowEdit()`/`composeTable()`) — for testing `row-edit-mutations.ts`
 * updater factories through `table.value`/`table.editing` in isolation.
 */
export function createMockTableStoreWithEditing<TRow>(
  rows: TRow[],
  trackBy: TrackByFn<TRow>
): TableStore<TRow> & RowEditMembers<TRow> {
  const data = signal<TRow[]>(rows);
  const indexById = computed(() => mockIndexById(data(), trackBy));
  const state = signal<EditingState<TRow>>({
    snapshots: new Map(),
    open: new Set(),
    unconfirmed: new Set(),
  });
  const value = createWritableView<TRow[], RowUpdater<TRow>>(
    () => data(),
    (updater) => data.update((current) => updater(current, { trackBy, indexById: indexById() }))
  );
  const editing = createWritableView<ReadonlySet<RowId>, EditingUpdater<TRow>>(
    () => state().open,
    (updater) =>
      state.set(
        updater(state(), {
          data: data(),
          trackBy,
          writeData: (rows) => value.update(() => rows),
          indexById: indexById(),
        })
      )
  );
  return {
    columns: createWritableView<ColumnDef<TRow>[], never>(() => [], () => undefined),
    rows: signal<TRow[]>(rows),
    renderRows: signal<RenderRow<TRow>[]>([]),
    renderColumns: signal<ColumnDef<TRow>[]>([]),
    totalRowCount: signal(rows.length),
    indexById,
    trackBy,
    value,
    editing,
    // Same derivation the feature uses, imported rather than restated — this stub deliberately
    // skips `withRowEdit()`'s single-mode trim, but `pending` must not drift from it.
    pending: computed(() => pendingIds(state())),
    pendingOps: computed(() => pendingOps(state())),
    unconfirmed: computed(() => state().unconfirmed),
    draft: createDraftRows(() => data(), () => editing(), trackBy, () => indexById()),
  };
}

/** `createColumns()`'s `data` param is a type witness only, never read — this satisfies
 * that signature without a real signal. */
export function noData<TRow>(): () => readonly TRow[] | undefined {
  return () => undefined;
}

export interface FlatRow {
  id: string;
  name: string;
  parentId?: string | null;
}

/** Flat `parentId`-linked mirror of `with-tree.spec.ts`'s own `makeRows()` nested fixture: the
 *  same r1 -> c1 -> g1 / c2, r2 tree, as five flat rows instead of nested `children` arrays. */
// Input order [g1, r1, c1, r2, c2] puts g1 (a forward reference) ahead of its parent c1, and
// mixes an explicit `parentId: null` root (r1) with an omitted-property root (r2), so both
// root spellings are exercised. `name` values are chosen so a name-descending sort swaps both
// the root order and r1's own children order (with-tree.spec.ts seam C, #167).
export function makeFlatRows(): FlatRow[] {
  return [
    { id: 'g1', name: 'G Grandchild', parentId: 'c1' },
    { id: 'r1', name: 'A Parent', parentId: null },
    { id: 'c1', name: 'C Child One', parentId: 'r1' },
    { id: 'r2', name: 'Z Leaf' },
    { id: 'c2', name: 'D Child Two', parentId: 'r1' },
  ];
}
