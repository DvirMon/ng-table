import { Component, computed, input, linkedSignal, signal } from '@angular/core';
import {
  createTable,
  setGroupLevels,
  withComputed,
  withExpansion,
  withGrouping,
  withSorting,
} from '../../../index';
import { GROUPING_ROWS_MOCK } from '../fixtures/mock';
import { createGroupedRowsResource, toErrorMessage } from '../fixtures/http';
import {
  COLLAPSIBLE_GROUPING_LEVELS,
  groupingConfig,
  RENESTED_GROUPING_LEVELS,
} from '../fixtures/schema';
import type { DealPage, DealRow } from '../fixtures/types';
import { GROUPING_STORY_PIPES } from '../grouping-story.pipes';
import { GroupingCollapsibleToolbarComponent } from './grouping-collapsible-toolbar.component';

/**
 * Collapsible grouping, navigable outline
 *
 * `withGrouping()` + `withExpansion()` + `withSorting()` compose into a collapsible, sortable
 * outline — collapse or expand any group header to explore the hierarchy.
 *
 * Expand All passes `table.groupIds()` explicitly — `expandAll()` alone only discovers real
 * data rows via `childrenAccessor` and cannot reach a group header.
 */
@Component({
  selector: 'ngp-grouping-collapsible-story-host',
  templateUrl: './grouping-collapsible-story-host.component.html',
  styleUrls: ['../../styles/story-host.css', '../grouping-story.css'],
  imports: [...GROUPING_STORY_PIPES, GroupingCollapsibleToolbarComponent],
})
export class GroupingCollapsibleStoryHostComponent {
  readonly forceFailure = input(false);
  readonly latencyMs = input(600);

  /** Request counter, not a boolean — the story wants the idle mock to render before the first
   * click and every click after that to be a new request (no `reload()` needed). */
  private readonly refetchRequests = signal(0);

  protected readonly rowsPage = createGroupedRowsResource(() =>
    this.refetchRequests() === 0
      ? undefined
      : { forceFailure: this.forceFailure(), latencyMs: this.latencyMs() }
  );

  /** Bridges the resource's read-only page into the `WritableSignal` `createTable()` needs —
   * `linkedSignal`, never an `effect`, per the writable/derived split. */
  protected readonly data = linkedSignal<DealPage | undefined, DealRow[]>({
    source: () => (this.rowsPage.hasValue() ? this.rowsPage.value() : undefined),
    computation: (page, previous) => page?.rows ?? previous?.value ?? GROUPING_ROWS_MOCK,
  });

  protected readonly table = createTable(
    this.data,
    groupingConfig,
    withGrouping({ initialGrouping: COLLAPSIBLE_GROUPING_LEVELS }),
    withExpansion(),
    withSorting(),
    // Optional. Default: read `table.expandedRows().has(row.id)` directly in the template for
    // `kind: 'group'` rows (`row.isExpanded` already covers `kind: 'row'` — `renderRows()`
    // stamps it there, just never on group headers, since the tree stage early-returns for
    // `data === null`). This derive block trades that Set lookup for a second full-array map on
    // every recompute, just to give the template one uniform field across both row kinds — reach
    // for it only if a template touching the Set directly is the thing you want to avoid.
    withComputed((store) => ({
      displayRows: computed(() =>
        store.renderRows().map((row) =>
          row.kind === 'group' ? { ...row, isExpanded: store.expandedRows().has(row.id) } : row
        )
      ),
    }))
  );

  protected readonly visibleColumns = computed(() =>
    this.table
      .columns()
      .filter((column) => column.visible)
      .sort((a, b) => a.order - b.order)
  );

  protected readonly isRefetching = computed(() => this.rowsPage.isLoading());
  protected readonly refetchError = computed(() => {
    const error = this.rowsPage.error();
    return error ? toErrorMessage(error, 'Refresh failed.') : '';
  });
  protected readonly replacedRowCount = computed(() =>
    this.rowsPage.hasValue() ? this.rowsPage.value().total : 0
  );

  protected readonly isRenested = computed(
    () => this.table.grouping()[0] === RENESTED_GROUPING_LEVELS[0]
  );

  /** Whether a column is a grouping level, by id — the join between `grouping()` and `columns()`
   * that a column would carry itself if it had a `groupIndex` (#115). */
  protected readonly isGroupedById = computed<Record<string, boolean>>(() =>
    Object.fromEntries(this.table.grouping().map((level) => [level, true]))
  );

  protected expandAllGroups(): void {
    this.table.expandAll(this.table.groupIds());
  }

  protected collapseAllGroups(): void {
    this.table.collapseAll();
  }

  protected refetchRows(): void {
    this.refetchRequests.update((count) => count + 1);
  }

  protected regroup(): void {
    const nextLevels = this.isRenested() ? COLLAPSIBLE_GROUPING_LEVELS : RENESTED_GROUPING_LEVELS;
    this.table.grouping.update(setGroupLevels<DealRow>(nextLevels));
  }
}
