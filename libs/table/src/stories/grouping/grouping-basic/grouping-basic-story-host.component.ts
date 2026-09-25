import { Component, input, signal } from '@angular/core';
import {
  addGroupLevel,
  createTable,
  removeGroupLevel,
  reorderGroupLevels,
  setGroupLevels,
  withGrouping,
} from '../../../index';
import { GROUPING_ROWS_MOCK } from '../fixtures/mock';
import { groupingConfig, BASE_GROUPING_LEVELS } from '../fixtures/schema';
import type { DealRow } from '../fixtures/types';
import { GROUPING_STORY_PIPES } from '../grouping-story.pipes';

/**
 * Grouping, the baseline
 *
 * `withGrouping({ initial })` and nothing else — no schema, no predicate, no second feature. The
 * host to copy when reaching for grouping the first time.
 *
 * Array order is nesting order. The tab strip toggles a column as a level, the pills reorder and
 * remove them; every write goes through an updater on `table.grouping`.
 */
@Component({
  selector: 'ngp-grouping-basic-story-host',
  templateUrl: './grouping-basic-story-host.component.html',
  styleUrls: ['../../styles/story-host.css', '../grouping-story.css'],
  imports: [...GROUPING_STORY_PIPES],
})
export class GroupingBasicStoryHostComponent {
  readonly showCount = input(true);
  readonly stickyHeaders = input(false);

  protected readonly data = signal<DealRow[]>(GROUPING_ROWS_MOCK);
  protected readonly table = createTable(
    this.data,
    groupingConfig,
    withGrouping({ initial: BASE_GROUPING_LEVELS })
  );

  /** One control per column, one boolean state: grouped or not. The two writes stay separate
   * updaters — the toggle only picks which one this click is. */
  protected toggleGroupByColumn(columnId: string): void {
    if (this.table.isGroupedBy(columnId)) {
      this.table.grouping.update(removeGroupLevel<DealRow>(columnId));
      return;
    }
    this.table.grouping.update(addGroupLevel<DealRow>(columnId));
  }

  protected ungroupColumn(columnId: string): void {
    this.table.grouping.update(removeGroupLevel<DealRow>(columnId));
  }

  protected moveLevel(from: number, to: number): void {
    this.table.grouping.update(reorderGroupLevels<DealRow>(from, to));
  }

  protected resetLevels(): void {
    this.table.grouping.update(setGroupLevels<DealRow>(BASE_GROUPING_LEVELS));
  }
}
