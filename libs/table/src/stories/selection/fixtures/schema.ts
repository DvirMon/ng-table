import type { ColumnDefInput, TableConfig } from '../../../api/types';
import type { SelectionRow } from './types';

/** `locked` is data, not a column — it drives `enableRowSelection` and a per-row badge, so it
 * never needs its own cell. */
export const selectionColumns: ColumnDefInput<SelectionRow>[] = [{ id: 'name' }, { id: 'dept' }];

/** Config for `multi-selection/`. The row-selectability predicate stays with the
 * `withSelection()` call in the host — `TableConfig` has no selection slot. */
export const multiSelectionConfig: TableConfig<SelectionRow> = {
  trackBy: 'id',
  columns: selectionColumns,
};

/** Config for `single-selection/`. Identical shape: `enableMultiRowSelection: false` is a
 * construction-time argument to `withSelection()`, which is why single-select is a second story
 * rather than a toggle on the first. */
export const singleSelectionConfig: TableConfig<SelectionRow> = {
  trackBy: 'id',
  columns: selectionColumns,
};
