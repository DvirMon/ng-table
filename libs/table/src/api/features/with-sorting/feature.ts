import { computed, signal, type Signal } from '@angular/core';
import { Subject, type Observable } from 'rxjs';
import { readAccessor } from '../../../engine/cells';
import { buildValueOfContext, type ValueOfContext } from '../../../engine/resolvers';
import type {
  ColumnValuesOf,
  Feature,
  RowOf,
  Shape,
  TableFeatureSpec,
} from '../../../engine/types';
import { stageSchema } from '../../../schema/stage-schema';
import { stage } from '../../../schema/stage-rules';
import { assertDeclarationsAreKnown } from '../../../schema/validate';
import { createTableFeature } from '../../create-table-feature';
import { runSortingSchemaFn } from './schema';
import type { AnySortingRule, SortingSchemaFn, SortNullsOpts } from './types';
import type {
  ColumnDef,
  ColumnValueMap,
  DerivedDict,
  SortDirection,
  SortRule,
  TableStore,
} from '../../types';

export interface WithSortingConfig<TRow, TValues extends ColumnValueMap = ColumnValueMap> {
  /** Skips the client-side sort stage — the consumer's data must arrive pre-sorted.
   *  `sortChanged` still fires so a `manual` consumer can react and refetch.
   *  Defaults to `false`. */
  manual?: boolean;
  /** Accumulates a click-ordered multi-column sort instead of replacing it on
   *  each click; still cycles ascending → descending → unsorted per column.
   *  Defaults to `false` (single-column replace). */
  multi?: boolean;
  /** Per-column rules — null placement, comparator, sortability — recorded via
   * side-effecting declarator calls, keyed by declared column id. */
  schema?: SortingSchemaFn<TRow, TValues>;
}

// Store slice this feature reads, row-typed via `RowOf<In>`; `& Shape` bootstraps
// `RowOf<In>` since this feature only touches `columns`.
//
// Uses `ColumnValuesOf<In>`, not `Record<ColumnIdOf<In>, unknown>` — the latter
// self-references circularly under this F-bounded `In` (an extra `keyof Record<...>`
// indirection on `In.columns`); `ColumnValuesOf<In>` reads `In`'s own `__columnValues`
// phantom directly.
type SortingInput<In> = Pick<TableStore<RowOf<In>, ColumnValuesOf<In>>, 'columns'> & Shape;

export interface SortingMembers {
  /** Current sort state — an ordered rule array where earlier entries take
   *  priority. Empty (`[]`) when unsorted. */
  readonly sorting: Signal<SortRule[]>;
  /** Lookup from column id to its current direction, derived from `sorting`;
   *  a column absent from the map has no active rule. */
  readonly sortDirections: Signal<ReadonlyMap<string, SortDirection>>;
  /** Fires on every sort-state change — drives both client-side feedback and
   *  the `manual` mode's server-refetch trigger. */
  readonly sortChanged: Observable<SortRule[]>;

  /** Advances the column ascending → descending → unsorted, per `multi`'s
   *  replace/accumulate rule. No-ops if `sortable({ enable })` returns `false`. */
  toggleSort(columnId: string): void;
  /** Replaces the full sort state directly with `rules`, regardless of `multi`. */
  setSorting(rules: SortRule[]): void;
  /** Clears every active sort rule, returning the table to its unsorted state. */
  clearSorting(): void;
}

function toSortDirectionsMap(rules: SortRule[]): ReadonlyMap<string, SortDirection> {
  const directions = new Map<string, SortDirection>();
  for (const rule of rules) {
    directions.set(rule.columnId, rule.direction);
  }
  return directions;
}

function cycleSortRule(rules: SortRule[], columnId: string): SortRule[] {
  const index = rules.findIndex((rule) => rule.columnId === columnId);
  if (index === -1) {
    return [...rules, { columnId, direction: 'asc' }];
  }
  if (rules[index].direction === 'asc') {
    return rules.map((rule, i) => (i === index ? { ...rule, direction: 'desc' as const } : rule));
  }
  return rules.filter((_, i) => i !== index);
}

function replaceSortRule(rules: SortRule[], columnId: string): SortRule[] {
  const current = rules[0];
  if (!current || current.columnId !== columnId) {
    return [{ columnId, direction: 'asc' }];
  }
  if (current.direction === 'asc') {
    return [{ columnId, direction: 'desc' }];
  }
  return [];
}

function detectComparator<TRow>(
  accessor: (row: TRow) => unknown,
  rows: TRow[],
): (a: TRow, b: TRow) => number {
  const sample = rows.map(accessor).find((value) => value != null);
  if (sample instanceof Date) {
    return (a, b) => (accessor(a) as Date).getTime() - (accessor(b) as Date).getTime();
  }
  if (typeof sample === 'number') {
    return (a, b) => (accessor(a) as number) - (accessor(b) as number);
  }
  // String(), not `.toString()`: other rows can still be null/undefined even when the
  // detection sample was non-null, and `.toString()` would throw on those.
  return (a, b) => String(accessor(a)).localeCompare(String(accessor(b)));
}

// `null`/`undefined` are always empty; `''` only counts if the rule opts in.
function isEmpty(value: unknown, opts: SortNullsOpts | undefined): boolean {
  if (value == null) {
    return true;
  }
  return value === '' && opts?.emptyString === 'is-empty';
}

function nullsOrderFor(opts: SortNullsOpts | undefined): 'first' | 'last' {
  return opts?.order ?? 'last';
}

// Construction-time and deterministic regardless of which ids appear in dev — unlike
// `assertDeclarationsAreKnown`, never `ngDevMode`-gated.
function assertNoDuplicateRuleKinds<TRow>(rules: readonly AnySortingRule<TRow>[]): void {
  const seen = new Set<string>();
  for (const rule of rules) {
    const key = `${rule.kind}:${rule.columnId}`;
    if (seen.has(key)) {
      throw new Error(`[withSorting] ${rule.kind} declared twice on column '${rule.columnId}'`);
    }
    seen.add(key);
  }
}

function reportComparatorError(columnId: string): void {
  // eslint-disable-next-line no-console -- ADR-0014 floor reporting; no shared
  // degrade-logging abstraction yet.
  console.error(
    `[withSorting] comparator threw for column "${columnId}". Treating the affected ` +
      'comparison as equal for this evaluation.',
  );
}

// A throwing comparator degrades to `0` (equal) rather than failing the whole sort
// (ADR-0014); reports once per column per evaluation via `reportedColumns`.
function guardCompare<TRow>(
  compare: (a: TRow, b: TRow, ctx: ValueOfContext<TRow>) => number,
  columnId: string,
  reportedColumns: Set<string>,
): (a: TRow, b: TRow, ctx: ValueOfContext<TRow>) => number {
  return (a: TRow, b: TRow, ctx: ValueOfContext<TRow>): number => {
    try {
      return compare(a, b, ctx);
    } catch {
      if (!reportedColumns.has(columnId)) {
        reportedColumns.add(columnId);
        reportComparatorError(columnId);
      }
      return 0;
    }
  };
}

function reportEnableError(columnId: string): void {
  // eslint-disable-next-line no-console -- ADR-0014 floor reporting, mirrors
  // `reportComparatorError`.
  console.error(
    `[withSorting] enable threw for column "${columnId}". Treating the column as sortable ` +
      'for this evaluation.',
  );
}

// A throwing `enable` degrades to `true` (still sortable) rather than blocking the toggle
// (ADR-0014). Read at call time inside `toggleSort`, never cached.
function guardEnable(enable: () => boolean, columnId: string): boolean {
  try {
    return enable();
  } catch {
    reportEnableError(columnId);
    return true;
  }
}

function sortRows<TRow>(
  rows: TRow[],
  rules: SortRule[],
  columns: ColumnDef<TRow>[],
  nullsByColumn: ReadonlyMap<string, SortNullsOpts>,
  compareByColumn: ReadonlyMap<string, (a: TRow, b: TRow, ctx: ValueOfContext<TRow>) => number>,
  knownIds: ReadonlySet<string>,
): TRow[] {
  if (rules.length === 0) {
    return rows;
  }
  const columnById = new Map(columns.map((column) => [column.id, column]));
  const reportedAccessorColumns = new Set<string>();
  const reportedComparatorColumns = new Set<string>();
  const ctx = buildValueOfContext<TRow>(() => columns, knownIds, 'withSorting');
  const comparators = rules.flatMap((rule) => {
    const column = columnById.get(rule.columnId);
    if (!column) {
      return [];
    }
    const accessor = (row: TRow): unknown => readAccessor(column, row, reportedAccessorColumns);
    const compare = guardCompare(
      compareByColumn.get(column.id) ?? detectComparator(accessor, rows),
      column.id,
      reportedComparatorColumns,
    );
    const sign = rule.direction === 'asc' ? 1 : -1;
    const nulls = nullsOrderFor(nullsByColumn.get(column.id));

    return [
      (a: TRow, b: TRow): number => {
        const aEmpty = isEmpty(accessor(a), nullsByColumn.get(column.id));
        const bEmpty = isEmpty(accessor(b), nullsByColumn.get(column.id));
        if (aEmpty || bEmpty) {
          if (aEmpty && bEmpty) return 0;
          // NOT multiplied by `sign` — placement stays on the same end regardless of direction.
          return (aEmpty ? 1 : -1) * (nulls === 'last' ? 1 : -1);
        }
        return sign * compare(a, b, ctx);
      },
    ];
  });

  return [...rows].sort((a, b) => {
    for (const compare of comparators) {
      const result = compare(a, b);
      if (result !== 0) {
        return result;
      }
    }
    return 0;
  });
}

// `TValues` is unread in the body — it only makes `input`'s type match whatever value
// map `SortingInput<In>` resolved to for the caller.
function buildSortingSpec<TRow, TValues extends ColumnValueMap = ColumnValueMap>(
  input: Pick<TableStore<TRow, TValues>, 'columns'>,
  config: WithSortingConfig<TRow, TValues>,
): TableFeatureSpec<TRow, SortingMembers> {
  const manual = config.manual ?? false;
  const multi = config.multi ?? false;

  const declaredRules = config.schema ? runSortingSchemaFn<TRow, TValues>(config.schema) : [];
  // Fixed at this factory's own construction time, reused below by `sortRows`'s resolver
  // guard — never rebuilt from a later, live `input.columns()` read.
  const knownIds = new Set(input.columns().map((column) => column.id));
  assertDeclarationsAreKnown(
    declaredRules.map((rule) => rule.columnId),
    knownIds,
    'withSorting',
  );
  assertNoDuplicateRuleKinds(declaredRules);

  const nullsByColumn = new Map<string, SortNullsOpts>();
  const compareByColumn = new Map<
    string,
    (a: TRow, b: TRow, ctx: ValueOfContext<TRow>) => number
  >();
  const enableByColumn = new Map<string, () => boolean>();
  for (const rule of declaredRules) {
    if (rule.kind === 'sort-nulls') {
      nullsByColumn.set(rule.columnId, rule.opts);
    } else if (rule.kind === 'sort-fn') {
      compareByColumn.set(rule.columnId, rule.comparator);
    } else {
      enableByColumn.set(rule.columnId, rule.enable);
    }
  }

  const sorting = signal<SortRule[]>([]);
  const sortDirections = computed(() => toSortDirectionsMap(sorting()));
  const sortChangedSource = new Subject<SortRule[]>();

  function applySorting(rules: SortRule[]): void {
    sorting.set(rules);
    sortChangedSource.next(rules);
  }

  function toggleSort(columnId: string): void {
    const column = input.columns().find((c) => c.id === columnId);
    const enable = enableByColumn.get(columnId);
    const isSortable = !!column && (enable ? guardEnable(enable, columnId) : true);
    if (!isSortable) {
      return;
    }
    applySorting(multi ? cycleSortRule(sorting(), columnId) : replaceSortRule(sorting(), columnId));
  }

  return {
    members: {
      sorting: sorting.asReadonly(),
      sortDirections,
      sortChanged: sortChangedSource.asObservable(),
      toggleSort,
      setSorting: applySorting,
      clearSorting: () => applySorting([]),
    },
    stages: stageSchema<TRow>('pipeline', (s) => {
      stage(s.sort, {
        run: (rows) =>
          manual
            ? rows
            : sortRows(rows, sorting(), input.columns(), nullsByColumn, compareByColumn, knownIds),
      });
    }),
  };
}

/**
 * Adds three-state (ascending → descending → unsorted) sorting to a `createTable()`.
 *
 * @remarks
 * Per-column behavior — null/empty placement, comparator, sortability — comes from
 * `schema`, keyed by declared column id. See `WithSortingConfig` for `multi`/`manual`.
 *
 * @example
 * ```ts
 * withSorting({
 *   schema: (path) => {
 *     sortNulls(path.deletedAt, { order: 'last' });
 *     sortFn(path.amount, (a, b) => a - b);
 *     sortable(path.id, { enable: () => false });
 *   },
 * })
 * ```
 */
export function withSorting<In extends SortingInput<In>, D extends DerivedDict>(
  derive: Feature<NoInfer<In> & SortingMembers, D>,
): Feature<In, SortingMembers & D>;
export function withSorting<In extends SortingInput<In>>(
  config?: WithSortingConfig<RowOf<In>, ColumnValuesOf<In>>,
): Feature<In, SortingMembers>;
export function withSorting<In extends SortingInput<In>, D extends DerivedDict>(
  config: WithSortingConfig<RowOf<In>, ColumnValuesOf<In>> | undefined,
  derive: Feature<NoInfer<In> & SortingMembers, D>,
): Feature<In, SortingMembers & D>;
export function withSorting(
  a: WithSortingConfig<any, any> | Feature<any, any> = {},
  b?: Feature<any, any>,
): Feature<any, any> {
  const isDeriveFirst = typeof a === 'function';
  const config: WithSortingConfig<any, any> = isDeriveFirst ? {} : a;
  const derive = isDeriveFirst ? a : b;
  const factory = <In extends SortingInput<In>>(
    input: In,
  ): TableFeatureSpec<RowOf<In>, SortingMembers> => buildSortingSpec(input, config);
  const feature: Feature<any, any> = derive
    ? createTableFeature(factory, derive)
    : createTableFeature(factory);
  return Object.assign(feature, { displayName: 'withSorting' });
}
