import { applyEach, debounce, schema } from '@angular/forms/signals';
import { createColumns } from '../../../api/create-columns';
import type { GroupSummary, TableConfig } from '../../../api/types';
import type { GroupEditRow } from './grouping-editing.types';

/**
 * Orders group headers alphabetically, with the uncategorized (flat) cluster pinned first.
 *
 * @remarks
 * Without this, headers keep first-occurrence order — re-categorizing the row that introduced
 * a category reshuffles every header.
 */
export function compareCategoryGroups(
  a: GroupSummary<GroupEditRow>,
  b: GroupSummary<GroupEditRow>
): number {
  const isOnlyAFlat = !a.admitted && b.admitted;
  const isOnlyBFlat = a.admitted && !b.admitted;
  if (isOnlyAFlat) return -1;
  if (isOnlyBFlat) return 1;
  return String(a.key).localeCompare(String(b.key));
}

// `createColumns()`'s data witness is never read (`void data`, create-columns.ts) — only its
// type binds `TRow` for the builder below.
const groupEditData = (): readonly GroupEditRow[] | undefined => undefined;

const columns = createColumns(groupEditData, (col) => [col('name'), col('category')]);

export const groupEditTableConfig: TableConfig<GroupEditRow> = { trackBy: 'id', columns };

/** Commits the moment a value is picked (0ms), the same boundary as live-table's `dept` field —
 * there is no separate Save step to demonstrate the regroup. */
export const groupEditRowsSchema = schema<GroupEditRow[]>((path) =>
  applyEach(path, (row) => {
    debounce(row.category, 0);
  })
);
