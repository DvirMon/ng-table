import { createFilters } from '../../../filters/create-filters';
import { contains } from '../../../filters/rules';
import type { Filters } from '../../../filters/types';
import type { ColumnDefInput, ColumnId, TableConfig } from '../../../api/types';
import type { DealFilterState, DealRow } from './types';

/**
 * Sum of `amount` over a cluster's own leaves, at every depth (D9) — so a parent total is the
 * sum of its subtree, which is TanStack's blank-at-depth-0 bug not happening.
 *
 * Rejects a negative amount rather than summing it. `engine/grouping.ts` calls this **unwrapped**,
 * so one bad record takes the whole table down instead of blanking that group's summary — the
 * runtime-class failure ADR-0014's retrofit has not reached yet (#79). `grouping-static/`'s
 * "Break one group's summary" control injects exactly such a record on demand.
 */
function sumAmount(rows: DealRow[]): number {
  return rows.reduce((total, row) => {
    if (row.amount < 0) {
      throw new Error(
        `[grouping fixtures] amount ${row.amount} is negative and cannot be summed.`
      );
    }
    return total + row.amount;
  }, 0);
}

/** Shared by all three configs — the grouping stories differ in which features they compose, not
 * in what the table holds. `owner` is object-valued and `closedAt` a `Date` on purpose: grouping
 * by each is how S8's `object:[object Object]` sits next to a key that formats correctly. */
const dealColumns: ColumnDefInput<DealRow>[] = [
  { id: 'region', label: 'Region' },
  { id: 'category', label: 'Category' },
  { id: 'rep', label: 'Rep' },
  { id: 'amount', label: 'Amount', aggregateFn: sumAmount },
  { id: 'closedAt', label: 'Closed' },
  { id: 'owner', label: 'Owner' },
];

/** Base column order, in declaration order — what `groupedColumnMode: 'keep'` restores and what
 * `'move-to-front'` re-ranks against. */
export const DEAL_COLUMN_IDS: string[] = dealColumns.map((column) => column.id);

/**
 * One config per story, over one column list. Three names rather than one shared value so a
 * story can diverge later without turning this file into a write-edge between the three story
 * folders that import it.
 */
export const staticGroupingConfig: TableConfig<DealRow> = {
  trackBy: 'id',
  columns: dealColumns,
};

export const collapsibleGroupingConfig: TableConfig<DealRow> = {
  trackBy: 'id',
  columns: dealColumns,
};

export const groupedSelectionConfig: TableConfig<DealRow> = {
  trackBy: 'id',
  columns: dealColumns,
};

/** Two levels — enough to show a parent total that is the sum of its subtree without burying the
 * baseline in nesting. */
export const STATIC_GROUPING_LEVELS: ColumnId<DealRow>[] = ['region', 'category'];

/** Three levels, so collapsing a parent visibly hides a whole subtree (D11). */
export const COLLAPSIBLE_GROUPING_LEVELS: ColumnId<DealRow>[] = ['region', 'category', 'rep'];

/** What `grouping-collapsible/`'s Regroup control swaps to — the same three columns, re-nested, so
 * every group id changes and no previous collapse state can match. */
export const RENESTED_GROUPING_LEVELS: ColumnId<DealRow>[] = ['category', 'region', 'rep'];

/** Two levels — enough for an *ancestor* group to exist, which is what separates a cascade that
 * only reaches descendants from one that is also said to reach parents. */
export const SELECTION_GROUPING_LEVELS: ColumnId<DealRow>[] = ['region', 'category'];

/** The level `grouping-static/`'s "Group by a column that isn't there" control adds — no column
 * carries this id, so `resolveGroupingLevels` drops it and the table groups by the rest (D14). */
export const MISSING_GROUPING_LEVEL = 'territory';

/** Backs `grouping-static/`'s `external-list` group order — a caller-supplied ranking, the shape
 * a saved report or a pinned-priority list would take. Values absent from it sort last. */
export const EXTERNAL_GROUP_ORDER: readonly string[] = ['South', 'Midwest', 'North East'];

/**
 * One text criterion over `rep`. Deliberately minimal: `filter` precedes `group` in
 * `PIPELINE_ORDER`, so what a filter proves here is that counts and summaries are of *visible*
 * rows and that an emptied group disappears — not anything about filtering itself.
 *
 * Typed with `DealFilterState`, because the host reads the criterion back to render the input's
 * value — the default `TState` would hand it `unknown` behind a bracket access.
 *
 * Must be called from an injection context (a component field initializer).
 */
export function createDealFilters(): Filters<DealRow, DealFilterState> {
  return createFilters<DealRow, DealFilterState>((path) => {
    contains(path.rep);
  });
}
