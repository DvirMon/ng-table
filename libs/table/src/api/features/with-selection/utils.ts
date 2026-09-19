import type { RowId, TableStore } from '../../types';

/** The slice of the core store this helper reads. */
type SelectAllIdsInput<TRow> = Pick<TableStore<TRow>, 'rows' | 'value' | 'trackBy'>;

/**
 * Ids for every currently-visible/matching row (default), or every row when `includeHidden` is
 * set. Reads only core `TableStore` members. Pass the result straight to `select()`/`deselect()`.
 */
export function selectAllIds<TRow>(
  table: SelectAllIdsInput<TRow>,
  opts?: { includeHidden?: boolean }
): RowId[] {
  const rows = opts?.includeHidden ? table.value() : table.rows();
  return rows.map(table.trackBy);
}
