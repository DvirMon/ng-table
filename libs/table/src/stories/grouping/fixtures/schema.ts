import type { ColumnDefInput, ColumnId, TableConfig } from '../../../api/types';
import { contains } from '../../../api/features/with-filtering/rules';
import type { FiltersPath } from '../../../api/features/with-filtering/types';
import type { DealRow } from './types';

/**
 * Sum of `amount` over a cluster's own leaves, at every depth (D9) — so a parent total is the
 * sum of its subtree, which is TanStack's blank-at-depth-0 bug not happening.
 *
 * Rejects a negative amount rather than summing it. `engine/grouping.ts` calls this **unwrapped**,
 * so one bad record takes the whole table down instead of blanking that group's summary — the
 * runtime-class failure ADR-0014's retrofit has not reached yet. `grouping-regressions/`'s
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

/** One column list for every grouping story — they differ in which features they compose, not in
 * what the table holds. `owner` is the one column whose row field is an object, so it carries the
 * `accessor` that turns it into the value a cell renders; every other column falls back to the
 * default `row[id]`. Grouping no longer reads a column's `accessor` at all (D7 — a level's value
 * comes straight off the row field, or through the rule's own `extractValue`), so this list needs no
 * literal-id inference and takes a plain `ColumnDefInput<DealRow>[]` annotation. */
const dealColumns: ColumnDefInput<DealRow>[] = [
  { id: 'region', label: 'Region' },
  { id: 'category', label: 'Category' },
  { id: 'rep', label: 'Rep' },
  { id: 'amount', label: 'Amount', aggregateFn: sumAmount },
  { id: 'closedAt', label: 'Closed' },
  { id: 'owner', label: 'Owner', accessor: (row) => row.owner.name },
];

/** Base column order, in declaration order — what `groupedColumnMode: 'keep'` restores and what
 * `'move-to-front'` re-ranks against. */
export const DEAL_COLUMN_IDS: string[] = dealColumns.map((column) => column.id);

/** The one config every grouping story passes to `createTable()`. */
export const groupingConfig: TableConfig<DealRow> = {
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

/** The level `grouping-regressions/`'s "Group by a field that doesn't exist" control adds — no
 * `DealRow` field carries this key, so every row reads `undefined` for it and the table groups
 * everything into one phantom cluster instead of crashing (D7 — a grouping level names a row
 * field directly, with no column-existence guard). */
export const MISSING_GROUPING_LEVEL = 'territory';

/** Backs `grouping-regressions/`'s `external-list` group order — a caller-supplied ranking, the
 * shape a saved report or a pinned-priority list would take. Values absent from it sort last. */
export const EXTERNAL_GROUP_ORDER: readonly string[] = ['South', 'Midwest', 'North East'];

/** One text criterion over `rep`, used only by `grouping-selection/` — enough to move a
 * selected row out of view, and to show counts and summaries following the visible rows. */
export const dealFilters = (path: FiltersPath<DealRow>) => ({ rep: contains(path.rep) });
