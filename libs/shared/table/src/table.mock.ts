import { signal } from '@angular/core';

import type { ColumnDef, RenderRow, TableStore, TrackByFn } from './api/types';
import type { TableCore } from './engine/types';

/** Minimal `TableStore<unknown>` stub for directive DI-wiring tests — no real store behavior. */
export function createMockTableStore(): TableStore<unknown> {
  return {
    columns: signal<ColumnDef<unknown>[]>([]),
    rows: signal<unknown[]>([]),
    renderRows: signal<RenderRow<unknown>[]>([]),
    totalRowCount: signal(0),
    trackBy: () => 'stub-id',
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
 * Minimal store stub carrying a real writable `data` signal, for testing free functions
 * (`updateRows`) that write through to it — not a full `composeTable()` instance.
 */
export function createMockTableStoreWithData<TRow>(
  rows: TRow[],
  trackBy: TrackByFn<TRow>
): TableStore<TRow> & Pick<TableCore<TRow>, 'data'> {
  return {
    columns: signal<ColumnDef<TRow>[]>([]),
    rows: signal<TRow[]>(rows),
    renderRows: signal<RenderRow<TRow>[]>([]),
    totalRowCount: signal(rows.length),
    data: signal<TRow[]>(rows),
    trackBy,
  };
}
