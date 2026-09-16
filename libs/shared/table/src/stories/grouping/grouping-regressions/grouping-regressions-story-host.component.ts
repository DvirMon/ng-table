import { Component, computed, input, signal } from '@angular/core';
import {
  addGroupLevel,
  createTable,
  patchRow,
  setGroupLevels,
  withGrouping,
  type GroupSummary,
} from '../../../index';
import { GROUPING_ROWS_MOCK } from '../fixtures/mock';
import {
  EXTERNAL_GROUP_ORDER,
  groupingConfig,
  MISSING_GROUPING_LEVEL,
  STATIC_GROUPING_LEVELS,
} from '../fixtures/schema';
import type { DealRow } from '../fixtures/types';
import { formatValue } from '../fixtures/utils';
import { GROUPING_STORY_PIPES } from '../grouping-story.pipes';
import { GroupingRegressionsToolbarComponent } from './grouping-regressions-toolbar.component';
import type { GroupOrderMode } from './grouping-regressions.types';

/** The row "Break one group's summary" poisons, and the figure that restores it. Read off the
 * fixture rather than retyped, so the restore is exact. */
const BREAKABLE_ROW_ID = 'd1';
const BREAKABLE_ROW_AMOUNT =
  GROUPING_ROWS_MOCK.find((row) => row.id === BREAKABLE_ROW_ID)?.amount ?? 0;

/** Where a value absent from the caller's list sorts under `external-list`. */
const UNRANKED = EXTERNAL_GROUP_ORDER.length;

function externalRank(key: unknown): number {
  const index = EXTERNAL_GROUP_ORDER.indexOf(formatValue(key));
  return index === -1 ? UNRANKED : index;
}

/**
 * Grouping edge cases — deliberate misuse
 *
 * Renders three open grouping gaps rather than describing them: a comparator that throws, a
 * level naming no column, and an `aggregateFn` refusing its value. Copy `grouping-static/` for
 * normal usage, not this file.
 *
 * The throwing aggregate takes the whole table down instead of blanking one summary
 * ([#79](https://github.com/DvirMon/acme/issues/79)); the dropped level is reported nowhere
 * but this story's own on-canvas notice.
 */
@Component({
  selector: 'ngp-grouping-regressions-story-host',
  templateUrl: './grouping-regressions-story-host.component.html',
  styleUrls: ['../../styles/story-host.css', '../grouping-story.css'],
  imports: [...GROUPING_STORY_PIPES, GroupingRegressionsToolbarComponent],
})
export class GroupingRegressionsStoryHostComponent {
  readonly groupOrder = input<GroupOrderMode>('first-occurrence');
  readonly showCount = input(true);

  /**
   * One closure, every mode. A comparator per mode would teach a shape a consumer has to
   * un-learn — `withGrouping()` takes exactly one, and it reads a signal. `first-occurrence`
   * returns a constant 0, and the sort is stable, so the clustering order survives untouched.
   */
  private readonly compareGroups = (
    a: GroupSummary<DealRow>,
    b: GroupSummary<DealRow>
  ): number => {
    const mode = this.groupOrder();
    if (mode === 'throwing') {
      throw new Error('[grouping-regressions] groupOrder threw while ordering this sibling pair.');
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
    groupingConfig,
    withGrouping({
      initialGrouping: STATIC_GROUPING_LEVELS,
      groupOrder: this.compareGroups,
    })
  );

  protected readonly visibleColumns = computed(() =>
    this.table
      .columns()
      .filter((column) => column.visible)
      .sort((a, b) => a.order - b.order)
  );

  /**
   * The dropped-level report, computed by the story because the library has no channel for it:
   * `resolveGroupingLevels` drops an id naming no column and groups by the rest, silently.
   */
  protected readonly droppedLevels = computed(() => {
    const knownIds = new Set(this.table.columns().map((column) => column.id));
    return this.table.grouping().filter((level) => !knownIds.has(level));
  });

  protected readonly droppedLevelsText = computed(() => this.droppedLevels().join(', '));

  /** Read off the data, not a flag: the failure is data-dependent, which is exactly why
   * ADR-0014 classes it runtime rather than construction. */
  protected readonly isSummaryBroken = computed(() =>
    this.data().some((row) => row.amount < 0)
  );

  protected resetLevels(): void {
    this.table.grouping.update(setGroupLevels<DealRow>(STATIC_GROUPING_LEVELS));
  }

  protected groupByMissingColumn(): void {
    this.table.grouping.update(addGroupLevel<DealRow>(MISSING_GROUPING_LEVEL));
  }

  /** Poisons — or restores — one row's `amount`. A patched row, not a flag the fixture reads:
   * the `aggregateFn` fails on a *record*, which is the failure class ADR-0014 says must degrade
   * rather than throw. Today it throws. */
  protected toggleBrokenSummary(): void {
    const shouldBreak = !this.isSummaryBroken();
    this.table.value.update(
      patchRow<DealRow>(BREAKABLE_ROW_ID, {
        amount: shouldBreak ? -1 : BREAKABLE_ROW_AMOUNT,
      })
    );
  }
}
