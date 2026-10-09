import { Component, computed, input, signal } from '@angular/core';
import {
  addGroupLevel,
  createTable,
  groupOrder,
  NgpTableDirective,
  NgpTableRowDirective,
  removeGroupLevel,
  setGroupLevels,
  withGrouping,
  withSorting,
  type GroupSummary,
} from '../../../index';
import { GROUPING_ROWS_MOCK } from '../fixtures/mock';
import { BASE_GROUPING_LEVELS, EXTERNAL_GROUP_ORDER, groupingConfig } from '../fixtures/schema';
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
 * Sibling order — `groupOrder`
 *
 * Orders group *headers* among their siblings at one level. Not the rows inside a group, not
 * which groups exist (`when`), not which columns are levels (`initial`). `withSorting()` is
 * composed here because the header order is only legible next to the row sort it is not.
 *
 * With no comparator, siblings keep first-occurrence order — the order each key was first seen
 * while scanning the rows. A comparator receives `GroupSummary`, not a row, which is what makes
 * ordering by a cluster's size or by a caller's own ranking ordinary code.
 *
 * `groupOrder` never activates or deactivates a level: on a column that is not currently a
 * level it is a silent no-op. That is the split from `grouping`.
 */
@Component({
  selector: 'ngp-grouping-order-story-host',
  templateUrl: './grouping-order-story-host.component.html',
  styleUrls: ['../../styles/story-host.css', '../grouping-story.css'],
  imports: [NgpTableDirective, NgpTableRowDirective, ...GROUPING_STORY_PIPES],
})
export class GroupingOrderStoryHostComponent {
  readonly groupOrder = input<GroupOrderMode>('first-occurrence');
  readonly showCount = input(true);

  /**
   * One closure, every mode — a level takes exactly one comparator, and it may read a signal.
   * `first-occurrence` returns a constant 0, and the sort is stable, so the clustering order
   * survives untouched.
   */
  private readonly compareGroups = (a: GroupSummary<DealRow>, b: GroupSummary<DealRow>): number => {
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

  /** @internal not a Storybook control — story-canvas row source. */
  protected readonly data = signal<DealRow[]>(GROUPING_ROWS_MOCK);
  /** @internal not a Storybook control — the table instance the template renders. */
  protected readonly table = createTable(
    this.data,
    groupingConfig,
    withGrouping({
      initial: BASE_GROUPING_LEVELS,
      schema: (path) => {
        groupOrder(path.region, this.compareGroups);
        groupOrder(path.category, this.compareGroups);
        // Declared for a field that is not a level right now. Never activates one — this line is
        // inert until `rep` is added below, which is the whole difference from `grouping`.
        groupOrder(path.rep, this.compareGroups);
      },
    }),
    withSorting(),
  );

  /** @internal not a Storybook control — readout, not a knob. */
  protected readonly isRepGrouped = computed(() => this.table.isGroupedBy('rep'));

  /** @internal not a Storybook control.
   * The caller-supplied ranking, rendered so `external-list` reads as data rather than as a
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
