import { Component, computed, input, signal } from '@angular/core';
import {
  addGroupLevel,
  createTable,
  removeGroupLevel,
  setGroupLevels,
  withGrouping,
} from '../../../index';
import { GROUPING_ROWS_MOCK } from '../fixtures/mock';
import { groupingConfig, BASE_GROUPING_LEVELS } from '../fixtures/schema';
import type { DealRow } from '../fixtures/types';
import { GROUPING_STORY_PIPES } from '../grouping-story.pipes';
import type { GroupedColumnMode } from './grouping-columns.types';

/**
 * What happens to a column once it becomes a level
 *
 * Grouping by a column does not decide whether that column keeps its place in the table — the
 * library takes no position, so the disposition is consumer code.
 *
 * Three dispositions: keep it where it is, hide it because the group header already says its
 * value, or move it to the front so the levels read left to right. Each is a view over
 * `table.columns()`, never a write to it, so the user's own column layout is left untouched.
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

  /** The table's own column layout — what the user sees before any disposition. */
  protected readonly layoutColumns = computed(() => this.table.renderColumns());

  /** The layout with the chosen disposition applied — what the table renders. */
  protected readonly displayColumns = computed(() => {
    const mode = this.groupedColumnMode();
    const levels = this.table.grouping();
    const columns = this.layoutColumns();

    if (mode === 'hide') {
      return columns.filter((column) => !levels.includes(column.id));
    }
    if (mode === 'move-to-front') {
      const leading = levels.flatMap((id) => columns.filter((column) => column.id === id));
      const rest = columns.filter((column) => !levels.includes(column.id));
      return [...leading, ...rest];
    }
    return columns;
  });

  /** Columns `hide` took out of the rendered set — shown so it reads as a disposition rather
   * than as columns going missing. */
  protected readonly hiddenColumnLabels = computed(() => {
    const displayedIds = new Set(this.displayColumns().map((column) => column.id));
    return this.layoutColumns()
      .filter((column) => !displayedIds.has(column.id))
      .map((column) => column.label);
  });

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
}
