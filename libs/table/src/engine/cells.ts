import type { ColumnDef } from '../api/types';

/** Pure `cells` builders. No signals, no Angular. */

function reportAccessorError(columnId: string): void {
  // eslint-disable-next-line no-console -- ADR-0014: floor reporting mechanism, no existing
  // runtime-degradation logging abstraction to reuse in this codebase yet.
  console.error(
    `[createTable] accessor threw for column "${columnId}". Falling back to an undefined cell ` +
      'value for the affected row(s) in this evaluation.',
  );
}

/**
 * Reads a column's resolved value for one row, degrading to `undefined` on a throw.
 *
 * @remarks
 * Note: a throwing `accessor` must not fail the whole row (ADR-0014). Callers thread one
 * `reportedColumns` set per evaluation, so a column that always throws reports once — not
 * once per row.
 */
export function readAccessor<TRow>(
  column: ColumnDef<TRow>,
  row: TRow,
  reportedColumns: Set<string>,
): unknown {
  try {
    return column.accessor(row);
  } catch {
    if (!reportedColumns.has(column.id)) {
      reportedColumns.add(column.id);
      reportAccessorError(column.id);
    }
    return undefined;
  }
}

/** Builds every column's resolved value for one data row, keyed by column id. */
export function buildDataCells<TRow>(
  row: TRow,
  columns: ColumnDef<TRow>[],
  reportedColumns: Set<string>,
): Readonly<Record<string, unknown>> {
  const cells: Record<string, unknown> = {};
  for (const column of columns) {
    cells[column.id] = readAccessor(column, row, reportedColumns);
  }
  return cells;
}

/**
 * Builds a group row's cells from its aggregates — its only value source.
 *
 * @remarks
 * Note: column ids and row-field names are separate vocabularies (ADR-0021); a group's own
 * label lives on `groupKey.label`, never merged into `cells`.
 */
export function buildGroupCells(
  aggregates: Record<string, unknown> | undefined,
): Readonly<Record<string, unknown>> {
  return { ...aggregates };
}
