import type { FilterHandle, FilterNode, FilterRuleRecord, FilterValueOfContext, Filters } from '../filters.types';
import { pathsOf } from './validate';

/** @internal Side channel from a built `Filters` object back to its compiled records + node
 *  map, read only by `createFilterEvaluator` (issue #62's `withFiltering()` is the consumer). */
const FILTERS_INTERNAL: unique symbol = Symbol('FILTERS_INTERNAL');

export interface FiltersInternal<TRow> {
  readonly records: readonly FilterRuleRecord<TRow>[];
  readonly nodesByKey: ReadonlyMap<string, FilterNode<unknown>>;
  readonly pathToKey: ReadonlyMap<string, string>;
}

/** Stamps the compiled internal state onto a built `Filters` object — called once, by
 *  `createFilters()` itself, right after assembly. */
export function attachFiltersInternal<TRow>(
  filters: object,
  internal: FiltersInternal<TRow>
): void {
  (filters as { [FILTERS_INTERNAL]: FiltersInternal<TRow> })[FILTERS_INTERNAL] = internal;
}

function getFiltersInternal<TRow, TState extends Record<string, unknown>>(
  filters: Filters<TRow, TState>
): FiltersInternal<TRow> {
  return (filters as unknown as { [FILTERS_INTERNAL]: FiltersInternal<TRow> })[FILTERS_INTERNAL];
}

export function buildValueOfContext<TRow>(internal: FiltersInternal<TRow>): FilterValueOfContext<TRow> {
  return {
    valueOf(handle: FilterHandle<TRow, Extract<keyof TRow, string>>): unknown {
      const key = internal.pathToKey.get(handle.id);
      const node = key !== undefined ? internal.nodesByKey.get(key) : undefined;
      return node?.value();
    },
  };
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
 * of ADR-0014 are scoped to its lifetime. Two ways to spend it:
 *
 * - `filterRows` narrows a whole row set, wrapping per filter per evaluation as ADR-0014's
 *   granularity clause requires: a throwing filter narrows no row at all.
 * - `matchesRow` answers for one row, for callers holding a row predicate rather than a set
 *   (`FiltersRoot.matcher()`). A throwing filter stops narrowing from that row on; rows it
 *   already answered for keep its narrowing, which a per-row signature cannot avoid.
 *
 * Prefer `filterRows` wherever the rows are in hand.
 */
interface FilterEvaluator<TRow> {
  filterRows(rows: TRow[]): TRow[];
  matchesRow(row: TRow): boolean;
}

/**
 * Builds an evaluator for one `Filters` instance — create it once per filtering pass.
 *
 * @internal exported for `api/features/with-filtering.ts` (issue #62) only — not part of the
 * `index.ts` public barrel.
 */
export function createFilterEvaluator<TRow, TState extends Record<string, unknown>>(
  filters: Filters<TRow, TState>
): FilterEvaluator<TRow> {
  return createFilterEvaluatorFrom(getFiltersInternal(filters));
}

/**
 * Same evaluator, entered from the compiled state directly rather than through a built `Filters`
 * object — the path `FiltersRoot.matcher()` takes, which runs before the object exists.
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
    filterRows(rows: TRow[]): TRow[] {
      let narrowed = rows;
      for (const { record, criterion } of narrowingRecords()) {
        const kept: TRow[] = [];
        let failedRow: TRow | undefined;
        for (const row of narrowed) {
          const result = evaluateRecord(record, criterion, row);
          if (result === 'error') {
            failedRow = row;
            break; // stop here: the record is discarded whole, not applied to the rows it reached
          }
          if (result) {
            kept.push(row);
          }
        }
        if (failedRow !== undefined) {
          reportOnce(record, failedRow);
          continue; // degrade: this filter does not narrow for this evaluation, for any row
        }
        narrowed = kept;
      }
      return narrowed;
    },

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
