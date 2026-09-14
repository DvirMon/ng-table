import { Component, computed, effect, input, signal, untracked } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import type { ResourceRef } from '@angular/core';
import {
  addGroupLevel,
  createTable,
  patchRow,
  removeGroupLevel,
  reorderColumns,
  reorderGroupLevels,
  setGroupLevels,
  toggleColumnVisibility,
  withFiltering,
  withGrouping,
  type ColumnDef,
  type GroupingAsyncRule,
  type GroupSummary,
  type RenderRow,
} from '../../../index';
import { GROUPING_ROWS_MOCK } from '../fixtures/mock';
import {
  injectGroupedRowsApi,
  type GroupedRowsRequestOptions,
  type GroupingPreference,
} from '../fixtures/http';
import {
  createDealFilters,
  DEAL_COLUMN_IDS,
  EXTERNAL_GROUP_ORDER,
  MISSING_GROUPING_LEVEL,
  staticGroupingConfig,
  STATIC_GROUPING_LEVELS,
} from '../fixtures/schema';
import type { DealRow } from '../fixtures/types';
import {
  formatAmount,
  formatValue,
  isBlankGroupValue,
} from '../fixtures/utils';
import type { GroupedColumnMode, GroupOrderMode } from './grouping-static.types';

/** The row "Break one group's summary" poisons, and the figure that restores it. Read off the
 * fixture rather than retyped, so the restore is exact. */
const BREAKABLE_ROW_ID = 'd1';
const BREAKABLE_ROW_AMOUNT =
  GROUPING_ROWS_MOCK.find((row) => row.id === BREAKABLE_ROW_ID)?.amount ?? 0;

/** Where a value absent from the caller's list sorts under `external-list`. */
const UNRANKED = EXTERNAL_GROUP_ORDER.length;

function externalRank(key: unknown): number {
  const index = EXTERNAL_GROUP_ORDER.indexOf(formatValue(key));
  return index === -1 ? UNRANKED : index;
}

/**
 * The grouped table as its own product (`0-product/grouping.md` §Scope) — **not** a collapsible
 * one with the chevrons taken away. It composes `withGrouping()` + `withFiltering()` and
 * deliberately **no `withExpansion()`**: with nothing to expand, a chevron would be a control
 * that does nothing, and the static reading surface is what a printed or exported report is.
 *
 * Filtering is inherent here, not adjacent: product stories 1.2 and 1.3 are *about* the filtered
 * count and the filtered summary. Because `filter` precedes `group` in `PIPELINE_ORDER`, an empty
 * group is unrepresentable (F-G1) and `rowsOf()` is post-filter by construction.
 *
 * Three controls are **honest regressions**, annotated as live gaps rather than dressed up:
 * - *Break one group's summary* poisons one row's `amount`; `engine/grouping.ts` calls
 *   `aggregateFn` unwrapped, so the whole table goes down instead of that one summary blanking
 *   (S2, [#79](https://github.com/DvirMon/acme/issues/79)). It starts passing when ADR-0014's
 *   wrap lands.
 * - *Group by a column that isn't there* degrades to the remaining levels (D14) and **nothing in
 *   the library says so** — the on-canvas notice is this story's own arithmetic (4.4).
 * - The fixture's `null` / `undefined` / `''` regions render as three unlabelled groups (S7), and
 *   the object-valued `owner` column has no label path at all (S8) while the `Date` column next
 *   to it groups correctly.
 *
 * `groupOrder` is threaded through **one** comparator closure reading a signal, never a
 * comparator per mode, and is labelled developer config: P9c found no library anywhere that lets
 * a person order group instances by hand, so inventing that UX in a story would ship an unowned
 * capability.
 */
@Component({
  selector: 'ngp-grouping-static-story-host',
  templateUrl: './grouping-static-story-host.component.html',
  styleUrls: ['../../styles/story-host.css', '../grouping-story.css'],
})
export class GroupingStaticStoryHostComponent {
  /** P6 — every peer that renders a count also ships a switch to hide it, default on. */
  readonly showCount = input(true);
  readonly groupOrder = input<GroupOrderMode>('first-occurrence');
  readonly groupedColumnMode = input<GroupedColumnMode>('keep');
  /** P8 — AG Grid alone ships this, and ships it default on. Here it is one CSS class keyed off
   * `data-row-kind`, which is what settles OQ-3's "is it just CSS?" on screen. */
  readonly stickyHeaders = input(false);

  /** Off for `Default` and `ThrowingGroupOrder`. While off, the rule's `params` is `undefined`, so
   * its resource never leaves `idle`, the fold abstains, and `grouping` is exactly `baseGrouping` —
   * the two other stories behave as though no rule were declared at all. */
  readonly asyncGroupingRule = input(false);
  readonly forceFailure = input(false);
  readonly latencyMs = input(2500);

  private readonly groupedRowsApi = injectGroupedRowsApi();

  /** Captured out of the rule's own `factory` so the pending window is legible on canvas. The
   * table's public surface exposes the folded `grouping()`, never the rule's resource. */
  private asyncRuleResource: ResourceRef<GroupingPreference | undefined> | undefined;

  /**
   * D13's guarantee, as a rule rather than an `effect()`: while the resource is unresolved the
   * entry is `undefined`, `foldGroupingRules` abstains for the whole set, and the base/overlay fold
   * falls back to `baseGrouping` — so the table **holds the last explicit grouping** instead of
   * flashing ungrouped. On failure `onError` must produce an explicit boolean (D13/D15): `false`
   * here, which resolves the set to `[]` — actively grouped by nothing, which is a different state
   * from abstaining, and the one the story shows.
   */
  private readonly repGroupingRule: GroupingAsyncRule<
    DealRow,
    GroupedRowsRequestOptions,
    GroupingPreference
  > = {
    kind: 'grouping-async',
    columnId: 'rep',
    params: () =>
      this.asyncGroupingRule()
        ? { forceFailure: this.forceFailure(), latencyMs: this.latencyMs() }
        : undefined,
    factory: (params) => {
      const ref = rxResource({
        params: () => params(),
        stream: ({ params: requestOptions }) =>
          this.groupedRowsApi.fetchGroupingPreference(requestOptions),
      });
      this.asyncRuleResource = ref;
      return ref;
    },
    onSuccess: (preference) => preference.groupByRep,
    onError: () => false,
  };

  /**
   * One closure, every mode. Passing a different comparator per mode would teach a shape a
   * consumer has to un-learn — `withGrouping()` takes exactly one, and it reads a signal.
   * `first-occurrence` returns a constant 0: `sortClusters` sorts with a stable sort, so the
   * `Map` insertion order `buildClusters` produced survives untouched.
   */
  private readonly compareGroups = (
    a: GroupSummary<DealRow>,
    b: GroupSummary<DealRow>
  ): number => {
    const mode = this.groupOrder();
    if (mode === 'throwing') {
      throw new Error('[grouping-static] groupOrder threw while ordering this sibling pair.');
    }
    if (mode === 'by-label') {
      return formatValue(a.key).localeCompare(formatValue(b.key));
    }
    if (mode === 'by-count') {
      return b.rows.length - a.rows.length;
    }
    if (mode === 'external-list') {
      return externalRank(a.key) - externalRank(b.key);
    }
    return 0;
  };

  protected readonly data = signal<DealRow[]>(GROUPING_ROWS_MOCK);
  protected readonly filters = createDealFilters();
  protected readonly table = createTable(
    this.data,
    staticGroupingConfig,
    withGrouping({
      initialGrouping: STATIC_GROUPING_LEVELS,
      groupOrder: this.compareGroups,
      rules: [this.repGroupingRule],
    }),
    withFiltering({ filters: this.filters })
  );

  /** `columns()` is the folded list, not a render order — it carries `visible`/`order` and leaves
   * the reading to whoever renders it. */
  protected readonly visibleColumns = computed(() =>
    this.table
      .columns()
      .filter((column) => column.visible)
      .sort((a, b) => a.order - b.order)
  );

  protected readonly repFilter = computed(() => this.filters.rep().value());

  /**
   * 4.4's third criterion, computed by the story because the library has no channel for it:
   * `resolveGroupingLevels` drops an id naming no column and groups by the rest, silently.
   */
  protected readonly droppedLevels = computed(() => {
    const knownIds = new Set(this.table.columns().map((column) => column.id));
    return this.table.grouping().filter((level) => !knownIds.has(level));
  });

  /** Read off the data, not a flag: the failure is data-dependent, which is exactly why
   * ADR-0014 classes it runtime rather than construction. */
  protected readonly isSummaryBroken = computed(() =>
    this.data().some((row) => row.amount < 0)
  );

  /** `'idle'` until the arg turns the rule on — which is what keeps the other two stories'
   * behaviour identical to before the rule existed. */
  protected readonly asyncRuleStatus = computed(() => this.asyncRuleResource?.status() ?? 'idle');

  protected readonly isGroupingRulePending = computed(
    () => this.asyncRuleResource?.isLoading() ?? false
  );

  constructor() {
    effect(() => this.syncGroupedColumnMode());
  }

  protected onFilterRep(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }
    this.filters.rep().value.set(target.value);
  }

  protected isGroupedBy(columnId: string): boolean {
    return this.table.grouping().includes(columnId);
  }

  protected levelLabel(columnId: string): string {
    return this.table.columns().find((column) => column.id === columnId)?.label ?? columnId;
  }

  protected groupLabel(row: RenderRow<DealRow>): string {
    return formatValue(row.groupKey?.value);
  }

  protected isBlankGroup(row: RenderRow<DealRow>): boolean {
    return isBlankGroupValue(row.groupKey?.value);
  }

  protected groupRowCount(row: RenderRow<DealRow>): number {
    return this.table.rowsOf(row).length;
  }

  /** P7 — the summary goes on the header row, at every depth, so a parent total is the sum of its
   * subtree. Only `amount` carries an `aggregateFn`; every other column's cell stays empty. */
  protected groupAggregate(row: RenderRow<DealRow>, columnId: string): string {
    return formatAmount(row.aggregates?.[columnId]);
  }

  protected cellValue(column: ColumnDef<DealRow>, row: DealRow): string {
    const value = column.accessor(row);
    return column.id === 'amount' ? formatAmount(value) : formatValue(value);
  }

  protected groupByColumn(columnId: string): void {
    this.table.grouping.update(addGroupLevel<DealRow>(columnId));
  }

  protected ungroupColumn(columnId: string): void {
    this.table.grouping.update(removeGroupLevel<DealRow>(columnId));
  }

  protected moveLevel(from: number, to: number): void {
    this.table.grouping.update(reorderGroupLevels<DealRow>(from, to));
  }

  protected resetLevels(): void {
    this.table.grouping.update(setGroupLevels<DealRow>(STATIC_GROUPING_LEVELS));
  }

  protected groupByMissingColumn(): void {
    this.table.grouping.update(addGroupLevel<DealRow>(MISSING_GROUPING_LEVEL));
  }

  /** Poisons — or restores — one row's `amount`. A patched row, not a flag the fixture reads:
   * the `aggregateFn` fails on a *record*, which is the failure class ADR-0014 says must degrade
   * rather than throw. Today it throws. */
  protected toggleBrokenSummary(): void {
    const shouldBreak = !this.isSummaryBroken();
    this.table.value.update(
      patchRow<DealRow>(BREAKABLE_ROW_ID, {
        amount: shouldBreak ? -1 : BREAKABLE_ROW_AMOUNT,
      })
    );
  }

  /**
   * U2 on screen, over the already-public column updaters. Reads only the two signals that decide
   * the target state; the current column list is read and written inside `untracked()`, so the
   * effect never re-triggers itself off its own write.
   */
  private syncGroupedColumnMode(): void {
    const mode = this.groupedColumnMode();
    const grouping = this.table.grouping();

    untracked(() => {
      const shouldHideGroupedColumns = mode === 'hide';
      for (const column of this.table.columns()) {
        const isGroupedColumn = grouping.includes(column.id);
        const shouldBeVisible = !(shouldHideGroupedColumns && isGroupedColumn);
        if (column.visible !== shouldBeVisible) {
          this.table.columns.update(toggleColumnVisibility<DealRow>(column.id));
        }
      }

      const shouldMoveGroupedToFront = mode === 'move-to-front';
      const orderedIds = shouldMoveGroupedToFront
        ? [...grouping, ...DEAL_COLUMN_IDS.filter((id) => !grouping.includes(id))]
        : DEAL_COLUMN_IDS;
      this.table.columns.update(reorderColumns<DealRow>(orderedIds));
    });
  }
}
