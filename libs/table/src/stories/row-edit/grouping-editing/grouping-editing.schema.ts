import { applyEach, debounce, schema } from '@angular/forms/signals';
import type { ColumnDefInput, GroupSummary, TableConfig } from '../../../api/types';
import type { GroupEditRow } from './grouping-editing.types';

// Without a comparator, headers keep first-occurrence order — so re-categorizing the row that
// happened to introduce a category reshuffles every header. Alphabetical pins them. The
// uncategorized (flat) cluster stays on top, where a person is working through it.
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

const columns: ColumnDefInput<GroupEditRow>[] = [{ id: 'name' }, { id: 'category' }];

export const groupEditTableConfig: TableConfig<GroupEditRow> = { trackBy: 'id', columns };

// The select commits the instant a value is picked (0ms) — same commit boundary as live-table's
// dept field. There's no separate Save step to demonstrate the regroup.
export const groupEditRowsSchema = schema<GroupEditRow[]>((path) =>
  applyEach(path, (row) => {
    debounce(row.category, 0);
  })
);
