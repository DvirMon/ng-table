import { Component, computed, input, signal } from '@angular/core';
import type { HttpResourceRef } from '@angular/common/http';
import { createTable, groupingAsync, withGrouping } from '../../../index';
import { GROUPING_ROWS_MOCK } from '../fixtures/mock';
import { createGroupingPreferenceResource, type GroupingPreference } from '../fixtures/http';
import { groupingConfig, BASE_GROUPING_LEVELS } from '../fixtures/schema';
import type { DealRow } from '../fixtures/types';
import { GROUPING_STORY_PIPES } from '../grouping-story.pipes';

/**
 * Server-decided grouping level
 *
 * A `groupingAsync()`-shaped column rule lets the server choose the grouping level.
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

  protected readonly data = signal<DealRow[]>(GROUPING_ROWS_MOCK);
  protected readonly table = createTable(
    this.data,
    groupingConfig,
    withGrouping({
      initial: BASE_GROUPING_LEVELS,
      schema: (path) =>
        groupingAsync(path.rep, {
          params: () => ({ forceFailure: this.forceFailure(), latencyMs: this.latencyMs() }),
          factory: (params) => {
            const ref = createGroupingPreferenceResource(params);
            this.asyncRuleResource = ref;
            return ref;
          },
          onSuccess: (preference) => preference.groupByRep,
          onError: () => false,
        }),
    })
  );

  protected readonly asyncRuleStatus = computed(() => this.asyncRuleResource?.status() ?? 'idle');

  protected readonly isGroupingRulePending = computed(
    () => this.asyncRuleResource?.isLoading() ?? false
  );
}
