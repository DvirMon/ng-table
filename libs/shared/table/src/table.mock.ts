import { computed, signal } from '@angular/core';

import type { RowEditMembers } from './api/features/with-row-edit';
import { createDraftRows } from './api/features/draft-rows';
import {
  pendingIds,
  pendingOps,
  type EditingState,
  type EditingUpdater,
} from './api/features/editing-state';
import type { ColumnDef, RenderRow, RowId, RowUpdater, TableStore, TrackByFn } from './api/types';
import { createWritableView } from './engine/writable-view';

/** Minimal `TableStore<unknown>` stub for directive DI-wiring tests — no real store behavior. */
export function createMockTableStore(): TableStore<unknown> {
  return {
    columns: createWritableView<ColumnDef<unknown>[], never>(() => [], () => undefined),
    rows: signal<unknown[]>([]),
    renderRows: signal<RenderRow<unknown>[]>([]),
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

export interface GroupingMockRow {
  id: number;
  region: string;
  category: string;
  amount: number;
}

/** Deliberately unequal cluster sizes per (region, category) — `US > Electronics` has 2 rows,
 * every other leaf cluster has 1, so a parent average computed from its children's already-
 * computed averages (125) differs from the true leaf-level average (150) for `region: 'US'`.
 * See with-grouping Step 5 plan, "depth-correctness case." */
export const mockGroupingRows: GroupingMockRow[] = [
  { id: 1, region: 'US', category: 'Electronics', amount: 100 },
  { id: 2, region: 'US', category: 'Electronics', amount: 300 },
  { id: 3, region: 'US', category: 'Furniture', amount: 50 },
  { id: 4, region: 'EU', category: 'Electronics', amount: 20 },
  { id: 5, region: 'EU', category: 'Furniture', amount: 10 },
  { id: 6, region: 'EU', category: 'Furniture', amount: 90 },
];

export const mockGroupingTrackBy: TrackByFn<GroupingMockRow> = (row) => row.id;

/** Mirrors `engine/core.ts`'s `indexById` derivation, for the mock stores below — they don't
 * compose the real engine, so they build the map by hand off their own `data` signal. */
function mockIndexById<TRow>(rows: TRow[], trackBy: TrackByFn<TRow>): ReadonlyMap<RowId, number> {
  const map = new Map<RowId, number>();
  rows.forEach((row, index) => map.set(trackBy(row), index));
  return map;
}

/**
 * Minimal store stub carrying a real writable `value` view, for testing updater factories
 * through `table.value.update(...)` (D30) — not a full `composeTable()` instance.
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
