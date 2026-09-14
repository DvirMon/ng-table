import type { FilterHandle, FilterNode, FilterRuleRecord, FilterValueOfContext } from './types';
import { pathsOf } from './validate';

export interface FiltersInternal<TRow> {
  readonly records: readonly FilterRuleRecord<TRow>[];
  readonly nodesByKey: ReadonlyMap<string, FilterNode<unknown>>;
  readonly pathToKey: ReadonlyMap<string, string>;
}

export function buildValueOfContext<TRow>(internal: FiltersInternal<TRow>): FilterValueOfContext<TRow> {
  // Annotated so `valueOf` takes its generic signature contextually. The lookup is by
  // `handle.id` alone, so the handle's row type is irrelevant here.
  const context: FilterValueOfContext<TRow> = {
    valueOf(handle) {
      const key = internal.pathToKey.get(handle.id);
      const node = key !== undefined ? internal.nodesByKey.get(key) : undefined;
      return node?.value();
    },
  };
  return context;
}

function reportFilterError<TRow>(record: FilterRuleRecord<TRow>, row: TRow): void {
  const [firstPath] = pathsOf(record);
  const cell = firstPath !== undefined ? (row as Record<string, unknown>)[firstPath] : undefined;
  // eslint-disable-next-line no-console -- ADR-0014: floor reporting mechanism, no existing
  // runtime-degradation logging abstraction to reuse in this codebase yet.
  console.error(
    `[createFilters] The predicate for filter "${record.key}" threw while evaluating a row. ` +
      'This filter does not narrow for this evaluation; other filters are unaffected.',
    { key: record.key, predicate: record.predicate, cell }
  );
}

/** One record's own predicate against one row — `'error'` on a throwing predicate, never
 *  propagated further up. `'group'` (anyOf) ORs its children against the shared criterion.
 *  `row as Record<string, unknown>` is a generic-erasure read, not a validated cast — every
 *  path here was recorded from a real `keyof TRow` access, so the index always exists or reads
 *  `undefined`, which the R27 null policy already handles. */
function evaluateRecord<TRow>(
  record: FilterRuleRecord<TRow>,
  criterion: unknown,
  row: TRow
): boolean | 'error' {
  const rowRecord = row as Record<string, unknown>;

  if (record.children) {
    let sawError = false;
    for (const child of record.children) {
      try {
        if (child.predicate(rowRecord[child.path], criterion)) {
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
    return record.predicate(rowRecord[path], criterion);
  } catch {
    return 'error';
  }
}

/**
 * One evaluator instance is one **evaluation** — the once-per-filter reporting and degradation
 * of ADR-0014 are scoped to its lifetime. `matchesRow` answers for one row, for callers holding
 * a row predicate (`FiltersRoot.matcher()`). A throwing filter stops narrowing from that row on;
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

  let narrowingRecordsMemo: { record: FilterRuleRecord<TRow>; criterion: unknown }[] | undefined;

  /** The records that narrow this pass: node present, condition met, criterion non-empty. Gating
   *  and emptiness read criterion state, which is constant across one evaluation, so this
   *  resolves once per instance rather than once per row. */
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
      if (record.condition && !record.condition(buildValueOfContext<TRow>(internal))) {
        continue;
      }
      const criterion = node.active();
      if (criterion === undefined) {
        continue; // empty criterion — skip, never a candidate for a throw
      }
      narrowing.push({ record, criterion });
    }
    narrowingRecordsMemo = narrowing;
    return narrowing;
  }

  function reportOnce(record: FilterRuleRecord<TRow>, row: TRow): void {
    if (!reportedKeys.has(record.key)) {
      reportedKeys.add(record.key);
      reportFilterError(record, row);
    }
  }

  return {
    matchesRow(row: TRow): boolean {
      for (const { record, criterion } of narrowingRecords()) {
        if (droppedKeys.has(record.key)) {
          continue;
        }
        const result = evaluateRecord(record, criterion, row);
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
