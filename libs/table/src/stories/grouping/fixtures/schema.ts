import type { ColumnDefInput, TableConfig } from '../../../api/types';
import { contains } from '../../../api/features/with-filtering/rules';
import type { FiltersPath } from '../../../api/features/with-filtering/types';
import type { DealRow } from './types';

/**
 * Sums `amount` over a cluster's own leaves, at every depth, so a parent total is its subtree's
 * sum.
 *
 * @remarks
 * Note: throws on a negative amount rather than summing it, to exercise the aggregate-failure
 * degrade path in `grouping-aggregates/`'s "Make one row's amount unsummable" control.
 *
 * @example
 * ```ts
 * withGrouping({ schema: (path) => aggregate(path.amount, sumAmount) })
 * ```
 */
export function sumAmount(rows: DealRow[]): number {
  return rows.reduce((total, row) => {
    if (row.amount < 0) {
      throw new Error(
        `[grouping fixtures] amount ${row.amount} is negative and cannot be summed.`
      );
    }
    return total + row.amount;
  }, 0);
}

// One column list for every grouping story — they differ in which features they compose, not in
// what the table holds. `owner` is the one column whose row field is an object, so it carries the
// `accessor` that turns it into the value a cell renders; every other column falls back to the
// default `row[id]`. Grouping reads a level's value off that resolved accessor output (ADR-0024),
// which is what makes `owner` groupable by name at all. No array-level annotation: each `id` is
// individually `as const`, and the list closes with `satisfies` rather than a type annotation —
// an annotation would widen every id to `string` and turn every story's `path.<id>` access into
// an untyped index signature.
const dealColumns = [
  { id: 'region' as const, label: 'Region' },
  { id: 'category' as const, label: 'Category' },
  { id: 'rep' as const, label: 'Rep' },
  { id: 'amount' as const, label: 'Amount' },
  { id: 'closedAt' as const, label: 'Closed' },
  { id: 'owner' as const, label: 'Owner', accessor: (row: DealRow) => row.owner.name },
] satisfies ColumnDefInput<DealRow>[];

/** Base column order, in declaration order — what `groupedColumnMode: 'keep'` restores and what
 * `'move-to-front'` re-ranks against. */
export const DEAL_COLUMN_IDS: string[] = dealColumns.map((column) => column.id);

/** The config for every grouping story. No `TableConfig<DealRow>` annotation — that would default
 * `TId` to `string` and erase `dealColumns`' literal ids the same way an annotation on
 * `dealColumns` itself would; `satisfies` checks the shape without widening it. */
export const groupingConfig = {
  trackBy: 'id',
  columns: dealColumns,
} satisfies TableConfig<DealRow>;

/** Two levels — enough to show a parent total that is the sum of its subtree without burying the
 * baseline in nesting. */
export const BASE_GROUPING_LEVELS = ['region' as const, 'category' as const];

/** Three levels, so collapsing a parent visibly hides a whole subtree. */
export const COLLAPSIBLE_GROUPING_LEVELS = [
  'region' as const,
  'category' as const,
  'rep' as const,
];

/** What `grouping-collapsible/`'s Regroup control swaps to — the same three columns, re-nested, so
 * every group id changes and no previous collapse state can match. */
export const RENESTED_GROUPING_LEVELS = ['category' as const, 'region' as const, 'rep' as const];

/** Two levels — enough for an *ancestor* group to exist, which is what separates a cascade that
 * only reaches descendants from one that is also said to reach parents. */
export const SELECTION_GROUPING_LEVELS = ['region' as const, 'category' as const];

/** Backs `grouping-order/`'s `external-list` comparator — a caller-supplied ranking, the
 * shape a saved report or a pinned-priority list would take. Values absent from it sort last. */
export const EXTERNAL_GROUP_ORDER: readonly string[] = ['South', 'Midwest', 'North East'];

/** One text criterion over `rep`, used only by `grouping-selection/` — enough to move a
 * selected row out of view, and to show counts and summaries following the visible rows. */
export const dealFilters = (path: FiltersPath<DealRow>) => ({ rep: contains(path.rep) });
