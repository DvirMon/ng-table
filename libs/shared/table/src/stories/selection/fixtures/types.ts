import type { RowId } from '../../../api/types';

/** Fixture row for the selection stories. `locked` drives `enableRowSelection`; `dept` is the
 * filterable/groupable field. Wider than `EditRow` so select-all, a count and a
 * visible/hidden split have enough rows to be meaningful. */
export interface SelectionRow {
  id: RowId;
  name: string;
  dept: string;
  locked: boolean;
}
