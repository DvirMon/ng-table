import { Component, computed, input, signal } from '@angular/core';
import { applyAggregate, createTable, patchRow, withGrouping } from '../../../index';
import { GROUPING_ROWS_MOCK } from '../fixtures/mock';
import { groupingConfig, BASE_GROUPING_LEVELS, sumAmount } from '../fixtures/schema';
import type { DealRow } from '../fixtures/types';
import { GROUPING_STORY_PIPES } from '../grouping-story.pipes';
import { GroupingAggregatesToolbarComponent } from './grouping-aggregates-toolbar.component';

/** The row the toolbar poisons, and the figure that restores it. Read off the fixture rather
 * than retyped, so the restore is exact. */
const BREAKABLE_ROW_ID = 'd1';
const BREAKABLE_ROW_AMOUNT =
  GROUPING_ROWS_MOCK.find((row) => row.id === BREAKABLE_ROW_ID)?.amount ?? 0;

/**
 * Group aggregates — `applyAggregate`
 *
 * Aggregation is a grouping declaration, keyed by declared column id like every other data
 * concern a `schema` records — not a column option. That is what lets `amount` carry a total
 * with no row field of its own to compute it from. Every header at every depth gets one,
 * computed over that cluster's own leaves — so a parent total is the sum of its whole subtree,
 * not of the headers under it.
 *
 * The toolbar poisons one row so `sumAmount` throws on it. Per ADR-0014 the table stays up: that
 * one column's aggregate falls back to `undefined` for the affected groups, and the failure is
 * reported once per column per evaluation rather than once per group.
 */
@Component({
  selector: 'ngp-grouping-aggregates-story-host',
  templateUrl: './grouping-aggregates-story-host.component.html',
  styleUrls: ['../../styles/story-host.css', '../grouping-story.css'],
  imports: [...GROUPING_STORY_PIPES, GroupingAggregatesToolbarComponent],
})
export class GroupingAggregatesStoryHostComponent {
  readonly showCount = input(true);

  protected readonly data = signal<DealRow[]>(GROUPING_ROWS_MOCK);
  protected readonly table = createTable(
    this.data,
    groupingConfig,
    withGrouping({
      initial: BASE_GROUPING_LEVELS,
      schema: (path) => applyAggregate(path.amount, sumAmount),
    })
  );

  protected readonly visibleColumns = computed(() =>
    this.table
      .columns()
      .filter((column) => column.visible)
      .sort((a, b) => a.order - b.order)
  );

  /** Read off the data, not a flag — the failure is data-dependent (ADR-0014). */
  protected readonly isSummaryBroken = computed(() =>
    this.data().some((row) => row.amount < 0)
  );

  /** Poisons — or restores — one row's `amount`. A patched row, not a flag the fixture reads:
   * `aggregateFn` fails on a *record*. */
  protected toggleBrokenSummary(): void {
    const shouldBreak = !this.isSummaryBroken();
    this.table.value.update(
      patchRow<DealRow>(BREAKABLE_ROW_ID, {
        amount: shouldBreak ? -1 : BREAKABLE_ROW_AMOUNT,
      })
    );
  }
}
