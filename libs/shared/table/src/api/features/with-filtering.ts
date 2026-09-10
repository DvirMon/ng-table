import { signal, type Signal } from '@angular/core';
import { Subject, type Observable } from 'rxjs';
import type { TableCore, TableFeatureSpec } from '../../engine/types';
import type { ColumnDef, FilterRule } from '../types';

export interface WithFilteringConfig {
  manual?: boolean;
}

/** The slice of the core store this feature reads. */
type FilteringInput<TRow> = Pick<TableCore<TRow>, 'columns'>;

/** Mirrors `FilteringState` from `docs/1-state/features/filtering.md` — the `filterChanged`
 * payload. */
export interface FilteringState {
  columnFilters: FilterRule[];
  globalFilter: string;
}

export interface FilteringMembers {
  readonly columnFilters: Signal<FilterRule[]>;
  readonly globalFilter: Signal<string>;
  readonly filterChanged: Observable<FilteringState>;

  setColumnFilter(columnId: string, value: unknown): void;
  clearColumnFilter(columnId: string): void;
  setGlobalFilter(query: string): void;
  clearFilters(): void;
}

function upsertFilterRule(
  rules: FilterRule[],
  columnId: string,
  value: unknown
): FilterRule[] {
  const index = rules.findIndex((rule) => rule.columnId === columnId);
  if (index === -1) {
    return [...rules, { columnId, value }];
  }
  return rules.map((rule, i) => (i === index ? { ...rule, value } : rule));
}

/** D3: no `filterFn` on an actively-filtered column falls back to string-contains
 * (case-insensitive) for string values, strict equality otherwise. */
function defaultFilterMatch(value: unknown, filterValue: unknown): boolean {
  if (typeof value === 'string') {
    return value.toLowerCase().includes(String(filterValue).toLowerCase());
  }
  return value === filterValue;
}

function matchesColumnFilter<TRow>(
  row: TRow,
  column: ColumnDef<TRow>,
  filterValue: unknown
): boolean {
  const match = column.filterFn ?? defaultFilterMatch;
  return match(column.accessor(row), filterValue);
}

/** D1: case-insensitive string-contains against every enabled column's accessor. */
function matchesGlobalFilter<TRow>(
  row: TRow,
  columns: ColumnDef<TRow>[],
  query: string
): boolean {
  const needle = query.toLowerCase();
  return columns.some((column) => {
    if (column.enableFiltering === false) {
      return false;
    }
    const value = column.accessor(row);
    return value != null && String(value).toLowerCase().includes(needle);
  });
}

function filterRows<TRow>(
  rows: TRow[],
  columnFilters: FilterRule[],
  globalFilter: string,
  columns: ColumnDef<TRow>[]
): TRow[] {
  if (columnFilters.length === 0 && !globalFilter) {
    return rows;
  }
  const columnById = new Map(columns.map((column) => [column.id, column]));

  return rows.filter((row) => {
    const passesColumnFilters = columnFilters.every((rule) => {
      const column = columnById.get(rule.columnId);
      // Missing column, or opted out via `enableFiltering: false` (D-behavior in spec) —
      // skip the check rather than exclude the row.
      if (!column || column.enableFiltering === false) {
        return true;
      }
      return matchesColumnFilter(row, column, rule.value);
    });
    if (!passesColumnFilters) {
      return false;
    }
    return !globalFilter || matchesGlobalFilter(row, columns, globalFilter);
  });
}

/**
 * Adds per-column and global/quick-search filtering to a `createTable()`. Reads `filterFn` /
 * `enableFiltering` directly off the core `columns` config — no compile-time feature
 * dependency (see `docs/1-state/features/filtering.md`).
 *
 * Column filters and the global filter combine with AND logic. A column with no `filterFn`
 * falls back to string-contains / strict equality (D3).
 */
export function withFiltering<TRow = unknown>(
  config: WithFilteringConfig = {}
): (core: FilteringInput<TRow>) => TableFeatureSpec<TRow, FilteringMembers> {
  const manual = config.manual ?? false;

  return (core: FilteringInput<TRow>): TableFeatureSpec<TRow, FilteringMembers> => {
    const columnFilters = signal<FilterRule[]>([]);
    const globalFilter = signal('');
    const filterChangedSource = new Subject<FilteringState>();

    function emitFilterChanged(): void {
      filterChangedSource.next({
        columnFilters: columnFilters(),
        globalFilter: globalFilter(),
      });
    }

    function setColumnFilter(columnId: string, value: unknown): void {
      columnFilters.set(upsertFilterRule(columnFilters(), columnId, value));
      emitFilterChanged();
    }

    function clearColumnFilter(columnId: string): void {
      columnFilters.set(columnFilters().filter((rule) => rule.columnId !== columnId));
      emitFilterChanged();
    }

    function setGlobalFilter(query: string): void {
      globalFilter.set(query);
      emitFilterChanged();
    }

    function clearFilters(): void {
      columnFilters.set([]);
      globalFilter.set('');
      emitFilterChanged();
    }

    return {
      members: {
        columnFilters: columnFilters.asReadonly(),
        globalFilter: globalFilter.asReadonly(),
        filterChanged: filterChangedSource.asObservable(),
        setColumnFilter,
        clearColumnFilter,
        setGlobalFilter,
        clearFilters,
      },
      stages: {
        filter: (rows) =>
          manual
            ? rows
            : filterRows(rows, columnFilters(), globalFilter(), core.columns()),
      },
    };
  };
}
