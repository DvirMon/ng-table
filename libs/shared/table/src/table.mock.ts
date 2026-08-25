import { computed, signal } from '@angular/core';

import type { EditingMap } from './api/features/with-row-edit';
import type { RowEditMembers } from './api/features/with-row-edit';
import type { EditingState, EditingUpdater } from './api/row-edit-mutations';
import type { ColumnDef, RenderRow, RowUpdater, TableStore, TrackByFn } from './api/types';
import { createWritableView } from './engine/writable-view';

/** Minimal `TableStore<unknown>` stub for directive DI-wiring tests — no real store behavior. */
export function createMockTableStore(): TableStore<unknown> {
  return {
    columns: createWritableView<ColumnDef<unknown>[], never>(() => [], () => undefined),
    rows: signal<unknown[]>([]),
    renderRows: signal<RenderRow<unknown>[]>([]),
    totalRowCount: signal(0),
    trackBy: () => 'stub-id',
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

/**
 * Minimal store stub carrying a real writable `value` view, for testing updater factories
 * through `table.value.update(...)` (D30) — not a full `composeTable()` instance.
 */
export function createMockTableStoreWithData<TRow>(
  rows: TRow[],
  trackBy: TrackByFn<TRow>
): TableStore<TRow> {
  const data = signal<TRow[]>(rows);
  return {
    columns: createWritableView<ColumnDef<TRow>[], never>(() => [], () => undefined),
    rows: signal<TRow[]>(rows),
    renderRows: signal<RenderRow<TRow>[]>([]),
    totalRowCount: signal(rows.length),
    trackBy,
    value: createWritableView<TRow[], RowUpdater<TRow>>(
      () => data(),
      (updater) => data.update((current) => updater(current, { trackBy }))
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
  const state = signal<EditingState<TRow>>({ editing: new Map(), pending: new Map() });
  const value = createWritableView<TRow[], RowUpdater<TRow>>(
    () => data(),
    (updater) => data.update((current) => updater(current, { trackBy }))
  );
  return {
    columns: createWritableView<ColumnDef<TRow>[], never>(() => [], () => undefined),
    rows: signal<TRow[]>(rows),
    renderRows: signal<RenderRow<TRow>[]>([]),
    totalRowCount: signal(rows.length),
    trackBy,
    value,
    editing: createWritableView<EditingMap<TRow>, EditingUpdater<TRow>>(
      () => state().editing,
      (updater) =>
        state.set(
          updater(state(), {
            data: data(),
            trackBy,
            writeData: (rows) => value.update(() => rows),
          })
        )
    ),
    pending: computed(() => state().pending),
  };
}
