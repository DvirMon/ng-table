import { Component, computed, input, signal } from '@angular/core';
import type { HttpResourceRef } from '@angular/common/http';
import {
  createTable,
  withGrouping,
  type GroupingAsyncRule,
} from '../../../index';
import { GROUPING_ROWS_MOCK } from '../fixtures/mock';
import {
  createGroupingPreferenceResource,
  type GroupedRowsRequestOptions,
  type GroupingPreference,
} from '../fixtures/http';
import { groupingConfig, STATIC_GROUPING_LEVELS } from '../fixtures/schema';
import type { DealRow } from '../fixtures/types';
import { GROUPING_STORY_PIPES } from '../grouping-story.pipes';

/**
 * Server-decided grouping level
 *
 * An `applyGroupingAsync()`-shaped column rule lets the server choose the grouping level.
 * While unresolved, the table holds the last explicit grouping; once resolved, it replaces
 * the level set outright.
 *
 * `onError` must return an explicit boolean — a failure resolves to grouped by nothing, not
 * to no answer yet.
 */
@Component({
  selector: 'ngp-grouping-async-rule-story-host',
  templateUrl: './grouping-async-rule-story-host.component.html',
  styleUrls: ['../../styles/story-host.css', '../grouping-story.css'],
  imports: [...GROUPING_STORY_PIPES],
})
export class GroupingAsyncRuleStoryHostComponent {
  readonly forceFailure = input(false);
  readonly latencyMs = input(2500);
  readonly showCount = input(true);

  /** Captured out of the rule's own `factory` so the pending window is legible on canvas. The
   * table's public surface exposes the folded `grouping()`, never the rule's resource. */
  private asyncRuleResource: HttpResourceRef<GroupingPreference | undefined> | undefined;

  private readonly repGroupingRule: GroupingAsyncRule<
    DealRow,
    GroupedRowsRequestOptions,
    GroupingPreference
  > = {
    kind: 'grouping-async',
    columnId: 'rep',
    params: () => ({ forceFailure: this.forceFailure(), latencyMs: this.latencyMs() }),
    factory: (params) => {
      const ref = createGroupingPreferenceResource(params);
      this.asyncRuleResource = ref;
      return ref;
    },
    onSuccess: (preference) => preference.groupByRep,
    onError: () => false,
  };

  protected readonly data = signal<DealRow[]>(GROUPING_ROWS_MOCK);
  protected readonly table = createTable(
    this.data,
    groupingConfig,
    withGrouping({
      initialGrouping: STATIC_GROUPING_LEVELS,
      rules: [this.repGroupingRule],
    })
  );

  protected readonly visibleColumns = computed(() =>
    this.table
      .columns()
      .filter((column) => column.visible)
      .sort((a, b) => a.order - b.order)
  );

  /** Label per level id — see #115, which would put this on the column itself. */
  protected readonly columnLabelById = computed<Record<string, string>>(() =>
    Object.fromEntries(this.table.columns().map((column) => [column.id, column.label]))
  );

  protected readonly asyncRuleStatus = computed(() => this.asyncRuleResource?.status() ?? 'idle');

  protected readonly isGroupingRulePending = computed(
    () => this.asyncRuleResource?.isLoading() ?? false
  );
}
