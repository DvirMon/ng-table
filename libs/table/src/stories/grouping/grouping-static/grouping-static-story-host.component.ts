import { Component, computed, effect, input, linkedSignal, signal, untracked } from '@angular/core';
import {
  addGroupLevel,
  createTable,
  removeGroupLevel,
  reorderColumns,
  reorderGroupLevels,
  setGroupLevels,
  toggleColumnVisibility,
  withGrouping,
  type GroupKey,
} from '../../../index';
import { applyGrouping } from '../../../api/features/with-grouping/schema';
import { GROUPING_ROWS_MOCK } from '../fixtures/mock';
import { DEAL_COLUMN_IDS, groupingConfig, STATIC_GROUPING_LEVELS } from '../fixtures/schema';
import type { DealRow } from '../fixtures/types';
import { GROUPING_STORY_PIPES } from '../grouping-story.pipes';
import { GroupingStaticToolbarComponent } from './grouping-static-toolbar.component';
import type { GroupedColumnMode } from './grouping-static.types';

/** Blank in the product sense, not the JS sense: `null`, `undefined` and `''` all read as "this
 * deal has no region". */
function isPresentKey(key: GroupKey): boolean {
  return key !== null && key !== undefined && key !== '';
}

/**
 * Static grouping, no collapse
 *
 * `withGrouping()` alone, with levels editable from the UI. Every sibling grouping story
 * composes one more feature; this one composes nothing else, so its source is copyable as-is.
 *
 * Demonstrates AND-combination of table-wide and per-column `when` thresholds:
 * - Table-wide: blank region clusters are rejected (unless toggled off)
 * - Per-column (category): clusters with fewer than `minCategoryRowCount` rows are rejected
 *
 * Toggle `keepBlankRegionsFlat` and `applyMinCategorySize` in the Controls panel to see
 * the independent and combined effects.
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
  readonly keepBlankRegionsFlat = input(false);
  readonly applyMinCategorySize = input(false);
  readonly minCategoryRowCount = input(2);

  /** Resets from the `minCategoryRowCount` arg but stays writable from the toolbar's own number
   * input — a story-canvas edit, not a Storybook Controls edit. */
  protected readonly minCategoryRowCountValue = linkedSignal(() => this.minCategoryRowCount());

  protected readonly data = signal<DealRow[]>(GROUPING_ROWS_MOCK);
  protected readonly table = createTable(
    this.data,
    groupingConfig,
    withGrouping({
      initial: STATIC_GROUPING_LEVELS,
      when: (cluster) => !this.keepBlankRegionsFlat() || isPresentKey(cluster.key),
      // A `when`-only rule (no `enable`): contributes no level activation, only a per-column
      // predicate for 'category'. Checking the signals inside the predicate (not wrapping the
      // rule itself) allows reactive toggling without rebuilding the table.
      schema: (path) =>
        applyGrouping(path.category, {
          when: (cluster) =>
            !this.applyMinCategorySize() ||
            cluster.rows.length >= this.minCategoryRowCountValue(),
        }),
    })
  );

  /** `columns()` is the folded list, not a render order — it carries `visible`/`order` and leaves
   * the reading to whoever renders it. */
  protected readonly visibleColumns = computed(() =>
    this.table
      .columns()
      .filter((column) => column.visible)
      .sort((a, b) => a.order - b.order)
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

  /** One control per column, one boolean state: grouped or not. The two writes stay separate
   * updaters — the toggle only picks which one this click is. */
  protected toggleGroupByColumn(columnId: string): void {
    if (this.table.isGroupedBy(columnId)) {
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
