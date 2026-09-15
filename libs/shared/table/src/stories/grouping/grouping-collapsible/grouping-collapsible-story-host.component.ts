import { Component, computed, input, signal } from '@angular/core';
import {
  createTable,
  setGroupLevels,
  withExpansion,
  withGrouping,
  withSorting,
  type ColumnDef,
  type RenderRow,
} from '../../../index';
import { GROUPING_ROWS_MOCK } from '../fixtures/mock';
import { injectGroupedRowsApi } from '../fixtures/http';
import {
  COLLAPSIBLE_GROUPING_LEVELS,
  groupingConfig,
  RENESTED_GROUPING_LEVELS,
} from '../fixtures/schema';
import type { DealRow } from '../fixtures/types';
import { formatAmount, formatValue, isBlankGroupValue } from '../fixtures/utils';

/**
 * The grouped table as a navigable outline — `withGrouping()` + `withExpansion()` +
 * `withSorting()`. Sorting is inherent, not adjacent: product story 2.5's acceptance criteria are
 * literally "survives a sort change", and S-G1/S-G2 fall out of the same surface.
 *
 * **The chevron is a real `<button>` carrying `aria-expanded`** (P2 — every peer with a UI renders
 * one). P11's peer split is a symptom of nobody using a button: AG Grid binds `Enter`, MUI X binds
 * `Space`. A button gives both, so the split does not have to be picked. The whole header row is
 * an enlarged hit area (U3, Telerik 1525732 — a real ask, never implemented anywhere, so it is the
 * secondary target): the chevron carries no click handler of its own and its activation bubbles to
 * the row's one listener, which is why there is no double-fire to suppress.
 *
 * **Expand all is an honest regression.** `collapseAll()` is the library's and works. `expandAll()`
 * is not usable here at all: it walks `childrenAccessor` over real rows and a group header is not
 * a row (S5), so the story ships a consumer loop instead. Neither button can label itself
 * correctly either — there is no "is everything expanded" signal (S4, tracked as C3). P3 is why
 * that is defensible rather than an omission: the *verb* converges across peers, the *button* does
 * not.
 *
 * **What Refetch, Sort and Regroup are for** (2.5 / S3 / OQ-4): expansion state keys on
 * `group:>col:type:value` ids, which ADR-0006 never prunes — the id is **value**-derived, so a
 * value that formats differently between two renders breaks restoration silently. Refetch replaces
 * every row with a freshly-constructed object to race exactly that; the sort toggles race it
 * against a reordered pipeline; Regroup re-nests so every id changes at once and the state is
 * discarded wholesale rather than half-applied (mui-x #16495 is the half-applied failure — a
 * chevron reading expanded over content that is gone).
 *
 * Rows carrying `children` (E-G1) make the `'group'` and `'tree'` render stages both run. They are
 * two visibly different affordances that never trigger each other — primeng #18171 is what happens
 * when both features want the same toggle and the same row-level state slot.
 */
@Component({
  selector: 'ngp-grouping-collapsible-story-host',
  templateUrl: './grouping-collapsible-story-host.component.html',
  styleUrls: ['../../styles/story-host.css', '../grouping-story.css'],
})
export class GroupingCollapsibleStoryHostComponent {
  readonly forceFailure = input(false);
  readonly latencyMs = input(600);

  private readonly groupedRowsApi = injectGroupedRowsApi();

  protected readonly data = signal<DealRow[]>(GROUPING_ROWS_MOCK);
  protected readonly table = createTable(
    this.data,
    groupingConfig,
    withGrouping({ initialGrouping: COLLAPSIBLE_GROUPING_LEVELS }),
    withExpansion(),
    withSorting()
  );

  protected readonly visibleColumns = computed(() =>
    this.table
      .columns()
      .filter((column) => column.visible)
      .sort((a, b) => a.order - b.order)
  );

  /** What the last Refetch did, on canvas — the whole point is that collapse state above it did
   * not move, which is unreadable without saying the rows underneath were replaced. */
  protected readonly refetchStatus = signal('');
  protected readonly isRefetching = signal(false);

  protected readonly isRenested = computed(
    () => this.table.grouping()[0] === RENESTED_GROUPING_LEVELS[0]
  );

  protected readonly groupedColumnIds = computed(() => new Set(this.table.grouping()));

  protected isGroupExpanded(row: RenderRow<DealRow>): boolean {
    return this.table.expandedRows().has(row.id);
  }

  /** A `kind: 'group'` header never carries `isExpanded` — the `'group'` render stage does not
   * stamp it, and the `'tree'` stage passes `data === null` rows through untouched. Expansion is
   * read off `expandedRows` instead, which is also what the chevron binds. */
  protected groupLabel(row: RenderRow<DealRow>): string {
    return formatValue(row.groupKey?.value);
  }

  protected isBlankGroup(row: RenderRow<DealRow>): boolean {
    return isBlankGroupValue(row.groupKey?.value);
  }

  protected groupRowCount(row: RenderRow<DealRow>): number {
    return this.table.rowsOf(row).length;
  }

  protected groupAggregate(row: RenderRow<DealRow>, columnId: string): string {
    return formatAmount(row.aggregates?.[columnId]);
  }

  protected cellValue(column: ColumnDef<DealRow>, row: DealRow): string {
    const value = column.accessor(row);
    return column.id === 'amount' ? formatAmount(value) : formatValue(value);
  }

  protected chevronLabel(row: RenderRow<DealRow>): string {
    const action = this.isGroupExpanded(row) ? 'Collapse' : 'Expand';
    const name = this.isBlankGroup(row) ? 'the unlabelled group' : this.groupLabel(row);
    return `${action} ${name}`;
  }

  protected sortArrow(columnId: string): string {
    const direction = this.table.sortDirections().get(columnId);
    if (direction === 'asc') {
      return '▲';
    }
    if (direction === 'desc') {
      return '▼';
    }
    return '↕';
  }

  protected isGroupedColumn(columnId: string): boolean {
    return this.groupedColumnIds().has(columnId);
  }

  /**
   * S5's consumer loop. One pass per grouping level, because a collapsed group's descendants are
   * not in `renderRows()` until its parent opens — there is no tree to walk ahead of time, which
   * is exactly why `expandAll()` cannot do this.
   */
  protected expandAllGroups(): void {
    const maxPasses = this.table.grouping().length + 1;
    for (let pass = 0; pass < maxPasses; pass += 1) {
      const collapsed = this.collapsedGroupRows();
      if (collapsed.length === 0) {
        return;
      }
      for (const row of collapsed) {
        this.table.toggleExpanded(row.id);
      }
    }
  }

  /** The library's own verb, and it is correct here: `collapseAll()` empties `expandedRows`
   * outright, so it needs no knowledge of what a group is. The asymmetry with Expand all is the
   * regression, not a styling choice. */
  protected collapseAllGroups(): void {
    this.table.collapseAll();
  }

  protected refetchRows(): void {
    this.isRefetching.set(true);
    this.refetchStatus.set('Refreshing…');
    this.groupedRowsApi
      .fetchRows({ forceFailure: this.forceFailure(), latencyMs: this.latencyMs() })
      .subscribe({
        next: (page) => {
          this.table.value.update(() => page.rows);
          this.isRefetching.set(false);
          this.refetchStatus.set(
            `Replaced all ${page.total} rows with freshly-constructed objects — every row above is ` +
              'a different object than it was. Collapse state did not move.'
          );
        },
        error: (error: unknown) => {
          this.isRefetching.set(false);
          this.refetchStatus.set(
            `${error instanceof Error ? error.message : 'Refresh failed.'} Nothing was replaced, ` +
              'and collapse state did not move either.'
          );
        },
      });
  }

  protected regroup(): void {
    const nextLevels = this.isRenested() ? COLLAPSIBLE_GROUPING_LEVELS : RENESTED_GROUPING_LEVELS;
    this.table.grouping.update(setGroupLevels<DealRow>(nextLevels));
  }

  private collapsedGroupRows(): RenderRow<DealRow>[] {
    const expanded = this.table.expandedRows();
    return this.table.renderRows().filter((row) => {
      const isGroupHeader = row.kind === 'group';
      return isGroupHeader && !expanded.has(row.id);
    });
  }
}
