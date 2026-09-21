import { Component, computed, effect, input, signal, untracked } from '@angular/core';
import {
  addGroupLevel,
  createTable,
  removeGroupLevel,
  reorderColumns,
  setGroupLevels,
  toggleColumnVisibility,
  withGrouping,
} from '../../../index';
import { GROUPING_ROWS_MOCK } from '../fixtures/mock';
import {
  DEAL_COLUMN_IDS,
  groupingConfig,
  BASE_GROUPING_LEVELS,
} from '../fixtures/schema';
import type { DealRow } from '../fixtures/types';
import { GROUPING_STORY_PIPES } from '../grouping-story.pipes';
import type { GroupedColumnMode } from './grouping-columns.types';

/**
 * What happens to a column once it becomes a level
 *
 * Grouping by a column does not decide whether that column keeps its place in the table — the
 * library takes no position, so the disposition is consumer code over the public column
 * updaters, `toggleColumnVisibility` and `reorderColumns`.
 *
 * Three dispositions: keep it where it is, hide it because the group header already says its
 * value, or move it to the front so the levels read left to right.
 */
@Component({
  selector: 'ngp-grouping-columns-story-host',
  templateUrl: './grouping-columns-story-host.component.html',
  styleUrls: ['../../styles/story-host.css', '../grouping-story.css'],
  imports: [...GROUPING_STORY_PIPES],
})
export class GroupingColumnsStoryHostComponent {
  readonly groupedColumnMode = input<GroupedColumnMode>('keep');
  readonly showCount = input(true);

  protected readonly data = signal<DealRow[]>(GROUPING_ROWS_MOCK);
  protected readonly table = createTable(
    this.data,
    groupingConfig,
    withGrouping({ initial: BASE_GROUPING_LEVELS })
  );

  protected readonly visibleColumns = computed(() =>
    this.table
      .columns()
      .filter((column) => column.visible)
      .sort((a, b) => a.order - b.order)
  );

  /** Columns currently hidden because they are levels — rendered so `hide` reads as a disposition
   * rather than as columns going missing. */
  protected readonly hiddenColumnLabels = computed(() =>
    this.table
      .columns()
      .filter((column) => !column.visible)
      .map((column) => column.label)
  );

  constructor() {
    effect(() => this.syncGroupedColumnMode());
  }

  protected toggleGroupByColumn(columnId: string): void {
    if (this.table.isGroupedBy(columnId)) {
      this.table.grouping.update(removeGroupLevel<DealRow>(columnId));
      return;
    }
    this.table.grouping.update(addGroupLevel<DealRow>(columnId));
  }

  protected resetLevels(): void {
    this.table.grouping.update(setGroupLevels<DealRow>(BASE_GROUPING_LEVELS));
  }

  /**
   * Applies the chosen disposition over the public column updaters. Reads only the two signals
   * that decide the target state; the column list is read and written inside `untracked()`, so
   * the effect never re-triggers off its own write.
   */
  private syncGroupedColumnMode(): void {
    const mode = this.groupedColumnMode();
    const grouping = this.table.grouping();

    untracked(() => {
      const shouldHideGroupedColumns = mode === 'hide';
      for (const column of this.table.columns()) {
        const isGroupedColumn = this.table.isGroupedBy(column.id);
        const shouldBeVisible = !(shouldHideGroupedColumns && isGroupedColumn);
        if (column.visible !== shouldBeVisible) {
          this.table.columns.update(toggleColumnVisibility(column.id));
        }
      }

      const shouldMoveGroupedToFront = mode === 'move-to-front';
      const orderedIds = shouldMoveGroupedToFront
        ? [...grouping, ...DEAL_COLUMN_IDS.filter((id) => !grouping.includes(id))]
        : DEAL_COLUMN_IDS;
      this.table.columns.update(reorderColumns(orderedIds));
    });
  }
}
