import { computed, signal, type Signal } from '@angular/core';
import { Subject, type Observable } from 'rxjs';
import { SORT_NULLS } from '../../engine/columns';
import { readAccessor } from '../../engine/cells';
import type { ColumnIdOf, Feature, RowOf, Shape, TableFeatureSpec } from '../../engine/types';
import { readColumnMeta } from '../../columns-schema/metadata';
import type { SortNullsOpts } from '../../columns-schema/rules';
import { createTableFeature } from '../create-table-feature';
import type { ColumnDef, DerivedDict, SortDirection, SortRule, TableStore } from '../types';

export interface WithSortingConfig {
  manual?: boolean;
  multi?: boolean;
}

/** The store slice this feature reads, row-typed. F-bounded: `In extends SortingInput<In>`
 * gives the factory `input.columns(): ColumnDef<RowOf<In>>[]` with no cast. `& Shape` is the
 * bootstrap `RowOf<In>` needs, not a read: this feature touches only `columns`. */
// Recovers `TId` via `ColumnIdOf<In>` instead of defaulting to `string` — otherwise `In`'s real
// column-id union can't round-trip through this pick (#113).
type SortingInput<In> = Pick<TableStore<RowOf<In>, ColumnIdOf<In>>, 'columns'> & Shape;

export interface SortingMembers {
  readonly sorting: Signal<SortRule[]>;
  readonly sortDirections: Signal<ReadonlyMap<string, SortDirection>>;
  readonly sortChanged: Observable<SortRule[]>;

  toggleSort(columnId: string): void;
  setSorting(rules: SortRule[]): void;
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
    return rules.map((rule, i) =>
      i === index ? { ...rule, direction: 'desc' as const } : rule
    );
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
  rows: TRow[]
): (a: TRow, b: TRow) => number {
  const sample = rows.map(accessor).find((value) => value != null);
  if (sample instanceof Date) {
    return (a, b) =>
      (accessor(a) as Date).getTime() - (accessor(b) as Date).getTime();
  }
  if (typeof sample === 'number') {
    return (a, b) => (accessor(a) as number) - (accessor(b) as number);
  }
  // String(), not `.toString()` on the raw value — the spec's fallback is
  // locale string compare via `.toString()`, but individual rows can still hold
  // null/undefined even when the detection sample above found a non-null value
  // elsewhere in the column; String() handles that without throwing.
  return (a, b) =>
    String(accessor(a)).localeCompare(String(accessor(b)));
}

function readSortNulls<TRow>(column: ColumnDef<TRow>): SortNullsOpts | undefined {
  return readColumnMeta(column, SORT_NULLS);
}

/** `null`/`undefined` are always empty; `''` only counts if the column opts in. */
function isEmpty<TRow>(value: unknown, column: ColumnDef<TRow>): boolean {
  if (value == null) {
    return true;
  }
  return value === '' && readSortNulls(column)?.emptyString === 'is-empty';
}

function nullsOrderFor<TRow>(column: ColumnDef<TRow>): 'first' | 'last' {
  return readSortNulls(column)?.order ?? 'last';
}

function reportComparatorError(columnId: string): void {
  // eslint-disable-next-line no-console -- ADR-0014: floor reporting mechanism, no existing
  // runtime-degradation logging abstraction to reuse in this codebase yet.
  console.error(
    `[withSorting] comparator threw for column "${columnId}". Treating the affected ` +
      'comparison as equal for this evaluation.'
  );
}

// Note: a throwing comparator degrades to `0` (treated as equal) rather than failing the
// whole sort (ADR-0014). Reports once per column per evaluation via the shared
// `reportedColumns` set.
function guardCompare<TRow>(
  compare: (a: TRow, b: TRow) => number,
  columnId: string,
  reportedColumns: Set<string>
): (a: TRow, b: TRow) => number {
  return (a: TRow, b: TRow): number => {
    try {
      return compare(a, b);
    } catch {
      if (!reportedColumns.has(columnId)) {
        reportedColumns.add(columnId);
        reportComparatorError(columnId);
      }
      return 0;
    }
  };
}

function sortRows<TRow>(
  rows: TRow[],
  rules: SortRule[],
  columns: ColumnDef<TRow>[]
): TRow[] {
  if (rules.length === 0) {
    return rows;
  }
  const columnById = new Map(columns.map((column) => [column.id, column]));
  const reportedAccessorColumns = new Set<string>();
  const reportedComparatorColumns = new Set<string>();
  const comparators = rules.flatMap((rule) => {
    const column = columnById.get(rule.columnId);
    if (!column) {
      return [];
    }
    const accessor = (row: TRow): unknown =>
      readAccessor(column, row, reportedAccessorColumns);
    const compare = guardCompare(
      column.sortFn ?? detectComparator(accessor, rows),
      column.id,
      reportedComparatorColumns
    );
    const sign = rule.direction === 'asc' ? 1 : -1;
    const nulls = nullsOrderFor(column);

    return [(a: TRow, b: TRow): number => {
      const aEmpty = isEmpty(accessor(a), column);
      const bEmpty = isEmpty(accessor(b), column);
      if (aEmpty || bEmpty) {
        if (aEmpty && bEmpty) return 0;
        // NOT multiplied by `sign` — placement stays on the same end regardless of direction.
        return (aEmpty ? 1 : -1) * (nulls === 'last' ? 1 : -1);
      }
      return sign * compare(a, b);
    }];
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

// `TId` is never read in the body — it exists only so `input`'s type matches whatever id union
// the caller's `SortingInput<In>` resolved to (#113).
function buildSortingSpec<TRow, TId extends string = string>(
  input: Pick<TableStore<TRow, TId>, 'columns'>,
  config: WithSortingConfig
): TableFeatureSpec<TRow, SortingMembers> {
  const manual = config.manual ?? false;
  const multi = config.multi ?? false;

  const sorting = signal<SortRule[]>([]);
  const sortDirections = computed(() => toSortDirectionsMap(sorting()));
  const sortChangedSource = new Subject<SortRule[]>();

  function applySorting(rules: SortRule[]): void {
    sorting.set(rules);
    sortChangedSource.next(rules);
  }

  function toggleSort(columnId: string): void {
    const column = input.columns().find((c) => c.id === columnId);
    const isSortable = !!column && column.enableSorting !== false;
    if (!isSortable) {
      return;
    }
    applySorting(
      multi
        ? cycleSortRule(sorting(), columnId)
        : replaceSortRule(sorting(), columnId)
    );
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
    stages: {
      sort: (rows) =>
        manual ? rows : sortRows(rows, sorting(), input.columns()),
    },
  };
}

/**
 * Adds three-state (ascending -> descending -> unsorted) sorting to a `createTable()`. Reads
 * `sortFn` / `enableSorting` directly off `columns` — the row type comes from the store handed
 * in, never a call-site type argument.
 *
 * By default (`multi: false`), clicking a column replaces the sort with that
 * column alone. Pass `{ multi: true }` to accumulate a click-ordered,
 * multi-column priority sort instead.
 */
export function withSorting<In extends SortingInput<In>, D extends DerivedDict>(
  derive: Feature<NoInfer<In> & SortingMembers, D>
): Feature<In, SortingMembers & D>;
export function withSorting<In extends SortingInput<In>>(
  config?: WithSortingConfig
): Feature<In, SortingMembers>;
export function withSorting<In extends SortingInput<In>, D extends DerivedDict>(
  config: WithSortingConfig | undefined,
  derive: Feature<NoInfer<In> & SortingMembers, D>
): Feature<In, SortingMembers & D>;
export function withSorting(
  a: WithSortingConfig | Feature<any, any> = {},
  b?: Feature<any, any>
): Feature<any, any> {
  const isDeriveFirst = typeof a === 'function';
  const config: WithSortingConfig = isDeriveFirst ? {} : a;
  const derive = isDeriveFirst ? a : b;
  const factory = <In extends SortingInput<In>>(input: In): TableFeatureSpec<RowOf<In>, SortingMembers> =>
    buildSortingSpec(input, config);
  const feature: Feature<any, any> = derive
    ? createTableFeature(factory, derive)
    : createTableFeature(factory);
  return Object.assign(feature, { displayName: 'withSorting' });
}
