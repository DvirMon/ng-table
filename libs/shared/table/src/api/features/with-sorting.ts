import { computed, signal, type Signal } from '@angular/core';
import { Subject, type Observable } from 'rxjs';
import { SORT_NULLS } from '../../engine/columns';
import type { TableCore, TableFeatureSpec } from '../../engine/types';
import { readColumnMeta } from '../../schema/column-metadata';
import type { SortNullsOpts } from '../../schema/column-rules';
import type { ColumnDef, SortDirection, SortRule } from '../types';

export interface WithSortingConfig {
  manual?: boolean;
  multi?: boolean;
}

/** The slice of the core store this feature reads. */
type SortingInput<TRow> = Pick<TableCore<TRow>, 'columns'>;

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

function sortRows<TRow>(
  rows: TRow[],
  rules: SortRule[],
  columns: ColumnDef<TRow>[]
): TRow[] {
  if (rules.length === 0) {
    return rows;
  }
  const columnById = new Map(columns.map((column) => [column.id, column]));
  const comparators = rules.flatMap((rule) => {
    const column = columnById.get(rule.columnId);
    if (!column) {
      return [];
    }
    const compare = column.sortFn ?? detectComparator(column.accessor, rows);
    const sign = rule.direction === 'asc' ? 1 : -1;
    const nulls = nullsOrderFor(column);

    return [(a: TRow, b: TRow): number => {
      const aEmpty = isEmpty(column.accessor(a), column);
      const bEmpty = isEmpty(column.accessor(b), column);
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

/**
 * Adds three-state (ascending -> descending -> unsorted) sorting to a
 * `createTable()`. Reads `sortFn` / `enableSorting` directly off the core
 * `columns` config — no compile-time feature dependency (see with-sorting.md).
 *
 * By default (`multi: false`), clicking a column replaces the sort with that
 * column alone. Pass `{ multi: true }` to accumulate a click-ordered,
 * multi-column priority sort instead.
 */
export function withSorting<TRow = unknown>(
  config: WithSortingConfig = {}
): (core: SortingInput<TRow>) => TableFeatureSpec<TRow, SortingMembers> {
  const manual = config.manual ?? false;
  const multi = config.multi ?? false;

  return (core: SortingInput<TRow>): TableFeatureSpec<TRow, SortingMembers> => {
    const sorting = signal<SortRule[]>([]);
    const sortDirections = computed(() => toSortDirectionsMap(sorting()));
    const sortChangedSource = new Subject<SortRule[]>();

    function applySorting(rules: SortRule[]): void {
      sorting.set(rules);
      sortChangedSource.next(rules);
    }

    function toggleSort(columnId: string): void {
      const column = core.columns().find((c) => c.id === columnId);
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
          manual ? rows : sortRows(rows, sorting(), core.columns()),
      },
    };
  };
}
