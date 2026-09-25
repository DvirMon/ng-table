import type { FilterRuleRecord, FilterValueOfContext } from './types';
import type { FilterNode } from '../../api/features/with-filtering/types';
import type { ColumnDef } from '../../api/types';
import { readAccessor } from '../cells';
import { pathsOf } from './validate';

export interface FiltersInternal<TRow> {
  readonly records: readonly FilterRuleRecord<TRow>[];
  readonly nodesByKey: ReadonlyMap<string, FilterNode<unknown>>;
  readonly pathToKey: ReadonlyMap<string, string>;
  /** A getter, not a snapshot — `table.columns` is writable, so an evaluator built later in the
   *  table's lifetime must see the current list, not the one at schema-build time. */
  readonly columns: () => readonly ColumnDef<TRow>[];
}

export function buildCriterionOfContext<TRow>(internal: FiltersInternal<TRow>): FilterValueOfContext<TRow> {
  // Annotated so `criterionOf` takes its generic signature contextually. The lookup is by
  // `handle.id` alone, so the handle's row type is irrelevant here.
  const context: FilterValueOfContext<TRow> = {
    criterionOf(handle) {
      const key = internal.pathToKey.get(handle.id);
      const node = key !== undefined ? internal.nodesByKey.get(key) : undefined;
      return node?.value();
    },
  };
  return context;
}

function reportFilterError<TRow>(
  record: FilterRuleRecord<TRow>,
  row: TRow,
  readCell: (columnId: string, row: TRow) => unknown
): void {
  const [firstPath] = pathsOf(record);
  const cell = firstPath !== undefined ? readCell(firstPath, row) : undefined;
  // eslint-disable-next-line no-console -- ADR-0014: floor reporting mechanism, no existing
  // runtime-degradation logging abstraction to reuse in this codebase yet.
  console.error(
    `[withFiltering] The predicate for filter "${record.key}" threw while evaluating a row. ` +
      'This filter does not narrow for this evaluation; other filters are unaffected.',
    { key: record.key, predicate: record.predicate, cell }
  );
}

// A removed column is runtime, data-dependent — same classification as grouping's G72 for a
// level's column disappearing via `setColumns()`. Degrade, don't throw (ADR-0014).
function reportMissingColumnError<TRow>(record: FilterRuleRecord<TRow>, columnId: string): void {
  // eslint-disable-next-line no-console -- ADR-0014: floor reporting mechanism, no existing
  // runtime-degradation logging abstraction to reuse in this codebase yet.
  console.error(
    `[withFiltering] The filter "${record.key}" targets column "${columnId}", which is not in ` +
      'the current columns. This filter does not narrow for this evaluation.',
    { key: record.key, columnId }
  );
}

// One record's own predicate against one row — `'error'` on a throwing predicate, never
// propagated further. `'group'` (anyOf) ORs its children against the shared criterion. Cells
// come from `readCell`, the ADR-0014-wrapped `readAccessor` — never a direct row read.
function evaluateRecord<TRow>(
  record: FilterRuleRecord<TRow>,
  criterion: unknown,
  row: TRow,
  readCell: (columnId: string, row: TRow) => unknown
): boolean | 'error' {
  if (record.children) {
    let sawError = false;
    for (const child of record.children) {
      try {
        if (child.predicate(readCell(child.path, row), criterion)) {
          return true;
        }
      } catch {
        sawError = true;
      }
    }
    return sawError ? 'error' : false;
  }

  const [path] = record.paths;
  try {
    return record.predicate(readCell(path, row), criterion);
  } catch {
    return 'error';
  }
}

/**
 * One evaluator instance is one **evaluation** — once-per-filter reporting and degradation are
 * scoped to its lifetime. `matchesRow` answers for one row, for callers holding a row
 * predicate (`FiltersRoot.matcher()`). A throwing filter stops narrowing from that row on;
 * rows it already answered for keep its narrowing, which a per-row signature cannot avoid.
 */
interface FilterEvaluator<TRow> {
  matchesRow(row: TRow): boolean;
}

/**
 * Builds an evaluator from a filter set's compiled internal state — the domain's only evaluator
 * entry point. Not exported past the domain.
 *
 * @internal
 */
export function createFilterEvaluatorFrom<TRow>(
  internal: FiltersInternal<TRow>
): FilterEvaluator<TRow> {
  const reportedKeys = new Set<string>();
  const droppedKeys = new Set<string>();
  const reportedColumns = new Set<string>();

  // Built once per evaluator instance (= one evaluation), never per row — `internal.columns()`
  // is re-read fresh here so a later evaluation sees a `setColumns()` write in between.
  const columnById = new Map<string, ColumnDef<TRow>>();
  for (const column of internal.columns()) {
    columnById.set(column.id, column);
  }

  function readCell(columnId: string, row: TRow): unknown {
    const column = columnById.get(columnId);
    return column ? readAccessor(column, row, reportedColumns) : undefined;
  }

  let narrowingRecordsMemo: { record: FilterRuleRecord<TRow>; criterion: unknown }[] | undefined;

  function reportOnce(record: FilterRuleRecord<TRow>, row: TRow): void {
    if (!reportedKeys.has(record.key)) {
      reportedKeys.add(record.key);
      reportFilterError(record, row, readCell);
    }
  }

  function reportMissingColumnOnce(record: FilterRuleRecord<TRow>, columnId: string): void {
    if (!reportedKeys.has(record.key)) {
      reportedKeys.add(record.key);
      reportMissingColumnError(record, columnId);
    }
  }

  // The records that narrow this pass: node present, condition met, criterion non-empty,
  // column still present. Criterion state is constant across one evaluation, so this resolves
  // once per instance rather than once per row.
  function narrowingRecords(): { record: FilterRuleRecord<TRow>; criterion: unknown }[] {
    if (narrowingRecordsMemo !== undefined) {
      return narrowingRecordsMemo;
    }
    const narrowing: { record: FilterRuleRecord<TRow>; criterion: unknown }[] = [];
    for (const record of internal.records) {
      const node = internal.nodesByKey.get(record.key);
      if (!node) {
        continue;
      }
      const when = record.options?.when;
      const isGatedOff = when && !when(buildCriterionOfContext<TRow>(internal));
      if (isGatedOff) {
        continue;
      }
      const criterion = node.criterion();
      if (criterion === undefined) {
        continue; // empty criterion — skip, never a candidate for a throw
      }
      const missingPath = pathsOf(record).find((path) => !columnById.has(path));
      if (missingPath !== undefined) {
        droppedKeys.add(record.key);
        reportMissingColumnOnce(record, missingPath);
        continue; // degrade: a removed column never narrows for this evaluation
      }
      narrowing.push({ record, criterion });
    }
    narrowingRecordsMemo = narrowing;
    return narrowing;
  }

  return {
    matchesRow(row: TRow): boolean {
      for (const { record, criterion } of narrowingRecords()) {
        if (droppedKeys.has(record.key)) {
          continue;
        }
        const result = evaluateRecord(record, criterion, row, readCell);
        if (result === 'error') {
          droppedKeys.add(record.key);
          reportOnce(record, row);
          continue; // degrade: this filter stops narrowing for the rest of this evaluation
        }
        if (!result) {
          return false;
        }
      }
      return true;
    },
  };
}
