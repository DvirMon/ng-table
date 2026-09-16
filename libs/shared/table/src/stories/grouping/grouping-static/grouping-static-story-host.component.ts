import { Component, computed, effect, input, signal, untracked } from '@angular/core';
import {
  addGroupLevel,
  createTable,
  removeGroupLevel,
  reorderColumns,
  reorderGroupLevels,
  setGroupLevels,
  toggleColumnVisibility,
  withGrouping,
} from '../../../index';
import { GROUPING_ROWS_MOCK } from '../fixtures/mock';
import { DEAL_COLUMN_IDS, groupingConfig, STATIC_GROUPING_LEVELS } from '../fixtures/schema';
import type { DealRow } from '../fixtures/types';
import { GROUPING_STORY_PIPES } from '../grouping-story.pipes';
import { GroupingStaticToolbarComponent } from './grouping-static-toolbar.component';
import type { GroupedColumnMode } from './grouping-static.types';

/**
 * Static grouping, no collapse
 *
 * `withGrouping()` alone, with levels editable from the UI. Every sibling grouping story
 * composes one more feature; this one composes nothing else, so its source is copyable as-is.
 */
@Component({
  selector: 'ngp-grouping-static-story-host',
  templateUrl: './grouping-static-story-host.component.html',
  styleUrls: ['../../styles/story-host.css', '../grouping-story.css'],
  imports: [...GROUPING_STORY_PIPES, GroupingStaticToolbarComponent],
})
export class GroupingStaticStoryHostComponent {
  readonly showCount = input(true);
  readonly groupedColumnMode = input<GroupedColumnMode>('keep');
  readonly stickyHeaders = input(false);

  protected readonly data = signal<DealRow[]>(GROUPING_ROWS_MOCK);
  protected readonly table = createTable(
    this.data,
    groupingConfig,
    withGrouping({ initialGrouping: STATIC_GROUPING_LEVELS })
  );

  /** `columns()` is the folded list, not a render order — it carries `visible`/`order` and leaves
   * the reading to whoever renders it. */
  protected readonly visibleColumns = computed(() =>
    this.table
      .columns()
      .filter((column) => column.visible)
      .sort((a, b) => a.order - b.order)
  );

  /**
   * The two facts a group-by UI needs and `grouping()` does not carry: whether a column is a
   * level, and what a level is called. Both are joins between `grouping()` (bare column ids) and
   * `columns()`, and both would come off the column itself if it had a `groupIndex` — see #115.
   * Records rather than `Map`s so a template reads them by index instead of calling `.get()`.
   */
  protected readonly isGroupedById = computed<Record<string, boolean>>(() =>
    Object.fromEntries(this.table.grouping().map((level) => [level, true]))
  );

  protected readonly columnLabelById = computed<Record<string, string>>(() =>
    Object.fromEntries(this.table.columns().map((column) => [column.id, column.label]))
  );

  constructor() {
    effect(() => this.syncGroupedColumnMode());
  }

  protected groupByColumn(columnId: string): void {
    this.table.grouping.update(addGroupLevel<DealRow>(columnId));
  }

  protected ungroupColumn(columnId: string): void {
    this.table.grouping.update(removeGroupLevel<DealRow>(columnId));
  }

  /** Click-time only — the tab strip reads `isGroupedById()`, resolved once per change. */
  private isGroupedBy(columnId: string): boolean {
    return this.table.grouping().includes(columnId);
  }

  /** One control per column, one boolean state: grouped or not. The two writes stay separate
   * updaters — the toggle only picks which one this click is. */
  protected toggleGroupByColumn(columnId: string): void {
    if (this.isGroupedBy(columnId)) {
      this.ungroupColumn(columnId);
      return;
    }
    this.groupByColumn(columnId);
  }

  protected moveLevel(from: number, to: number): void {
    this.table.grouping.update(reorderGroupLevels<DealRow>(from, to));
  }

  protected resetLevels(): void {
    this.table.grouping.update(setGroupLevels<DealRow>(STATIC_GROUPING_LEVELS));
  }

  /**
   * What happens to a column once it becomes a level, over the public column updaters. Reads only
   * the two signals that decide the target state; the column list is read and written inside
   * `untracked()`, so the effect never re-triggers off its own write.
   */
  private syncGroupedColumnMode(): void {
    const mode = this.groupedColumnMode();
    const grouping = this.table.grouping();

    untracked(() => {
      const shouldHideGroupedColumns = mode === 'hide';
      for (const column of this.table.columns()) {
        const isGroupedColumn = grouping.includes(column.id);
        const shouldBeVisible = !(shouldHideGroupedColumns && isGroupedColumn);
        if (column.visible !== shouldBeVisible) {
          this.table.columns.update(toggleColumnVisibility<DealRow>(column.id));
        }
      }

      const shouldMoveGroupedToFront = mode === 'move-to-front';
      const orderedIds = shouldMoveGroupedToFront
        ? [...grouping, ...DEAL_COLUMN_IDS.filter((id) => !grouping.includes(id))]
        : DEAL_COLUMN_IDS;
      this.table.columns.update(reorderColumns<DealRow>(orderedIds));
    });
  }
}
