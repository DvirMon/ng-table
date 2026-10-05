import { createColumns } from '../../../api/create-columns';
import type { ColumnValues, TableConfig } from '../../../api/types';
import { contains } from '../../../api/features/with-filtering/rules';
import type { FiltersPath } from '../../../api/features/with-filtering/types';
import type { DealRow } from './types';

/**
 * Sums `amount` over a cluster's own leaves, at every depth, so a parent total is its subtree's
 * sum.
 *
 * @remarks
 * Throws on a negative amount rather than summing it, to exercise the aggregate-failure
 * degrade path in `grouping-aggregates/`'s "Make one row's amount unsummable" control.
 *
 * @example
 * ```ts
 * withGrouping({
 *   levels: ['region'],
 *   schema: (path) => aggregate(path.amount, sumAmount),
 * });
 * ```
 */
export function sumAmount(rows: DealRow[]): number {
  return rows.reduce((total, row) => {
    if (row.amount < 0) {
      throw new Error(`[grouping fixtures] amount ${row.amount} is negative and cannot be summed.`);
    }
    return total + row.amount;
  }, 0);
}

// `createColumns()`'s data witness is never read (`void data`, create-columns.ts) — only its
// type binds `TRow` for the builder below.
const dealData = (): readonly DealRow[] | undefined => undefined;

// One column set for every grouping story — they differ in composed features, not table
// contents. `owner`'s row field is an object, so it needs the `accessor` to produce a cell
// value; every other column falls back to the default `row[id]`. Grouping reads a level's value
// off that resolved accessor output (ADR-0024) — the reason `owner` groups by name at all.
// Hoisted to a module-level const so each `col()` call's literal id survives
// (`create-columns.types.spec.ts`'s case 1) instead of widening to `string` when read back off
// the const.
const dealColumnSet = createColumns(dealData, (col) => [
  col('region', { label: 'Region' }),
  col('category', { label: 'Category' }),
  col('rep', { label: 'Rep' }),
  col('amount', { label: 'Amount' }),
  col('closedAt', { label: 'Closed' }),
  col('owner', { label: 'Owner', accessor: (row) => row.owner.name }),
]);

/** Base column order, in declaration order — what `groupedColumnMode: 'keep'` restores and what
 * `'move-to-front'` re-ranks against. */
export const DEAL_COLUMN_IDS: string[] = dealColumnSet.columns.map((column) => column.id);

/** The config for every grouping story. */
// No `TableConfig<DealRow>` annotation — that would default `columns` to the wide union and lose
// `dealColumnSet`'s literal ids; `satisfies` checks the shape without widening it.
export const groupingConfig = {
  trackBy: 'id',
  columns: dealColumnSet,
} satisfies TableConfig<DealRow>;

/** Two levels — enough to show a parent total that is the sum of its subtree without burying the
 * baseline in nesting. */
export const BASE_GROUPING_LEVELS = ['region' as const, 'category' as const];

/** Three levels, so collapsing a parent visibly hides a whole subtree. */
export const COLLAPSIBLE_GROUPING_LEVELS = ['region' as const, 'category' as const, 'rep' as const];

/** What `grouping-collapsible/`'s Regroup control swaps to — the same three columns, re-nested, so
 * every group id changes and no previous collapse state can match. */
export const RENESTED_GROUPING_LEVELS = ['category' as const, 'region' as const, 'rep' as const];

/** Two levels — enough for an *ancestor* group to exist, distinguishing a cascade that reaches
 * only descendants from one that also reaches parents. */
export const SELECTION_GROUPING_LEVELS = ['region' as const, 'category' as const];

/** Backs `grouping-order/`'s `external-list` comparator — a caller-supplied ranking, the
 * shape a saved report or a pinned-priority list would take. Values absent from it sort last. */
export const EXTERNAL_GROUP_ORDER: readonly string[] = ['South', 'Midwest', 'North East'];

/** One text criterion over `rep`, used only by `grouping-selection/` — enough to move a
 * selected row out of view, and to show counts and summaries following the visible rows. */
export const dealFilters = (
  path: FiltersPath<DealRow, ColumnValues<DealRow, typeof dealColumnSet.columns>>,
) => ({ rep: contains(path.rep) });
