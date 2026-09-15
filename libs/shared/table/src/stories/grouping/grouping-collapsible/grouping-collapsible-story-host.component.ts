import { Component, computed, input, signal } from '@angular/core';
import {
  createTable,
  setGroupLevels,
  withExpansion,
  withGrouping,
  withSorting,
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
import { GROUPING_STORY_PIPES } from '../grouping-story.pipes';

/**
 * The grouped table as a navigable outline — `withGrouping()` + `withExpansion()` +
 * `withSorting()`. Expand all is the story's own loop, not `expandAll()`, which walks
 * `childrenAccessor` over real rows and cannot reach a group header. Scope, peer comparison and
 * the open gaps in `docs/0-product/grouping.md` §2.5.
 */
@Component({
  selector: 'ngp-grouping-collapsible-story-host',
  templateUrl: './grouping-collapsible-story-host.component.html',
  styleUrls: ['../../styles/story-host.css', '../grouping-story.css'],
  imports: [...GROUPING_STORY_PIPES],
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

  protected readonly isRefetching = signal(false);
  protected readonly replacedRowCount = signal(0);
  protected readonly refetchError = signal('');

  protected readonly isRenested = computed(
    () => this.table.grouping()[0] === RENESTED_GROUPING_LEVELS[0]
  );

  /** Whether a column is a grouping level, by id — the join between `grouping()` and `columns()`
   * that a column would carry itself if it had a `groupIndex` (#115). */
  protected readonly isGroupedById = computed<Record<string, boolean>>(() =>
    Object.fromEntries(this.table.grouping().map((level) => [level, true]))
  );

  /**
   * One pass per grouping level, because a collapsed group's descendants are not in `renderRows()`
   * until its parent opens — there is no tree to walk ahead of time.
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

  protected collapseAllGroups(): void {
    this.table.collapseAll();
  }

  protected refetchRows(): void {
    this.isRefetching.set(true);
    this.refetchError.set('');
    this.groupedRowsApi
      .fetchRows({ forceFailure: this.forceFailure(), latencyMs: this.latencyMs() })
      .subscribe({
        next: (page) => {
          this.table.value.update(() => page.rows);
          this.isRefetching.set(false);
          this.replacedRowCount.set(page.total);
        },
        error: (error: unknown) => {
          this.isRefetching.set(false);
          this.refetchError.set(error instanceof Error ? error.message : 'Refresh failed.');
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
