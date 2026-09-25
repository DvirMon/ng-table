import { Component, computed, input, linkedSignal, signal } from '@angular/core';
import { createTable, setGroupLevels, withGrouping, withTree } from '../../../index';
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
 * `withGrouping()` + `withTree()`, and nothing else — collapse or expand any group header to
 * explore the hierarchy. The `childrenAccessor` is passed explicitly: the fixture nests deal
 * line items under one deal (`DealRow.children`), and `withTree()` has no `row.children`
 * fallback.
 *
 * Expand All passes `table.groupIds()` explicitly. `tree.expand()` alone only discovers real
 * data rows via `childrenAccessor` and cannot reach a group header, which is the reason
 * `groupIds()` exists: it derives from the cluster tree rather than from `renderRows()`, so it
 * finds every header at every depth regardless of what is currently collapsed.
 *
 * Group headers and data rows both read `row.isExpanded` — `flattenVisible()` stamps it on
 * every render row once a composed feature contributes the expansion slot.
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
    withGrouping({ initial: COLLAPSIBLE_GROUPING_LEVELS }),
    withTree({ childrenAccessor: (row) => row.children })
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

  protected expandAllGroups(): void {
    this.table.tree.expand(this.table.groupIds());
  }

  protected collapseAllGroups(): void {
    this.table.tree.collapse();
  }

  protected refetchRows(): void {
    this.refetchRequests.update((count) => count + 1);
  }

  protected regroup(): void {
    const nextLevels = this.isRenested() ? COLLAPSIBLE_GROUPING_LEVELS : RENESTED_GROUPING_LEVELS;
    this.table.grouping.update(setGroupLevels<DealRow>(nextLevels));
  }
}
