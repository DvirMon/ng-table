import { Component, computed, input, signal } from '@angular/core';
import {
  addGroupLevel,
  applyGroupOrder,
  createTable,
  removeGroupLevel,
  setGroupLevels,
  withGrouping,
  type GroupSummary,
} from '../../../index';
import { GROUPING_ROWS_MOCK } from '../fixtures/mock';
import {
  BASE_GROUPING_LEVELS,
  EXTERNAL_GROUP_ORDER,
  plainGroupingConfig,
} from '../fixtures/schema';
import type { DealRow } from '../fixtures/types';
import { formatValue } from '../fixtures/utils';
import { GROUPING_STORY_PIPES } from '../grouping-story.pipes';
import type { GroupOrderMode } from './grouping-order.types';

/** Where a value absent from the caller's list sorts under `external-list`. */
const UNRANKED = EXTERNAL_GROUP_ORDER.length;

function externalRank(key: unknown): number {
  const index = EXTERNAL_GROUP_ORDER.indexOf(formatValue(key));
  return index === -1 ? UNRANKED : index;
}

/**
 * Sibling order — `applyGroupOrder`
 *
 * Orders group *headers* among their siblings at one level. Not the rows inside a group (that is
 * `withSorting()`), not which groups exist (`when`), not which columns are levels (`initial`).
 *
 * With no comparator, siblings keep first-occurrence order — the order each key was first seen
 * while scanning the rows. A comparator receives `GroupSummary`, not a row, which is what makes
 * ordering by a cluster's size or by a caller's own ranking ordinary code.
 *
 * `applyGroupOrder` never activates or deactivates a level: on a column that is not currently a
 * level it is a silent no-op. That is the split from `applyGrouping`.
 */
@Component({
  selector: 'ngp-grouping-order-story-host',
  templateUrl: './grouping-order-story-host.component.html',
  styleUrls: ['../../styles/story-host.css', '../grouping-story.css'],
  imports: [...GROUPING_STORY_PIPES],
})
export class GroupingOrderStoryHostComponent {
  readonly groupOrder = input<GroupOrderMode>('first-occurrence');
  readonly showCount = input(true);

  /**
   * One closure, every mode — a level takes exactly one comparator, and it may read a signal.
   * `first-occurrence` returns a constant 0, and the sort is stable, so the clustering order
   * survives untouched.
   */
  private readonly compareGroups = (
    a: GroupSummary<DealRow>,
    b: GroupSummary<DealRow>
  ): number => {
    const mode = this.groupOrder();
    if (mode === 'throwing') {
      throw new Error('[grouping-order] groupOrder threw while ordering this sibling pair.');
    }
    if (mode === 'by-label') {
      return formatValue(a.key).localeCompare(formatValue(b.key));
    }
    if (mode === 'by-count') {
      return b.rows.length - a.rows.length;
    }
    if (mode === 'external-list') {
      return externalRank(a.key) - externalRank(b.key);
    }
    return 0;
  };

  protected readonly data = signal<DealRow[]>(GROUPING_ROWS_MOCK);
  protected readonly table = createTable(
    this.data,
    plainGroupingConfig,
    withGrouping({
      initial: BASE_GROUPING_LEVELS,
      schema: (path) => {
        applyGroupOrder(path.region, this.compareGroups);
        applyGroupOrder(path.category, this.compareGroups);
        // Declared for a field that is not a level right now. Never activates one — this line is
        // inert until `rep` is added below, which is the whole difference from `applyGrouping`.
        applyGroupOrder(path.rep, this.compareGroups);
      },
    })
  );

  protected readonly visibleColumns = computed(() =>
    this.table
      .columns()
      .filter((column) => column.visible)
      .sort((a, b) => a.order - b.order)
  );

  protected readonly isRepGrouped = computed(() => this.table.isGroupedBy('rep'));

  /** The caller-supplied ranking, rendered so `external-list` reads as data rather than as a
   * comparator nobody can see. */
  protected readonly externalOrder = EXTERNAL_GROUP_ORDER;

  protected toggleRepLevel(): void {
    const updater = this.isRepGrouped()
      ? removeGroupLevel<DealRow>('rep')
      : addGroupLevel<DealRow>('rep');
    this.table.grouping.update(updater);
  }

  protected resetLevels(): void {
    this.table.grouping.update(setGroupLevels<DealRow>(BASE_GROUPING_LEVELS));
  }
}
