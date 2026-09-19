import { Component, computed, input, signal } from '@angular/core';
import {
  addGroupLevel,
  applyGroupKey,
  createTable,
  removeGroupLevel,
  withGrouping,
} from '../../../index';
import { GROUPING_ROWS_MOCK } from '../fixtures/mock';
import { plainGroupingConfig, MISSING_GROUPING_LEVEL } from '../fixtures/schema';
import type { DealRow } from '../fixtures/types';
import { GROUPING_STORY_PIPES } from '../grouping-story.pipes';

/** `YYYY-MM`, so twelve distinct `closedAt` timestamps collapse into five month buckets — a
 * primitive string, since the engine never normalizes or deep-compares a group key (D7). */
function monthOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Key derivation and label naming — `applyGroupKey` + `initial`'s `label` (D9)
 *
 * Two declarators, one lesson: `applyGroupKey` decides what a level clusters *on*; an `initial`
 * entry's `label` decides what its header *calls itself*. Both resolve independently of one
 * another, and both are visible in one render.
 *
 * `Sales Region` carries an explicit `initial` label — it wins over the `region` column's own
 * ("Region"). `Closed` has none, so it falls back to the `closedAt` column's own label. Adding
 * the undeclared `territory` field as a third level falls back all the way to the raw field name
 * — the three-tier resolution, in one table (D7a).
 */
@Component({
  selector: 'ngp-grouping-keys-story-host',
  templateUrl: './grouping-keys-story-host.component.html',
  styleUrls: ['../../styles/story-host.css', '../grouping-story.css'],
  imports: [...GROUPING_STORY_PIPES],
})
export class GroupingKeysStoryHostComponent {
  readonly bucketClosedAtByMonth = input(true);
  readonly showCount = input(true);

  protected readonly data = signal<DealRow[]>(GROUPING_ROWS_MOCK);
  protected readonly table = createTable(
    this.data,
    plainGroupingConfig,
    withGrouping({
      initial: [{ key: 'region', label: 'Sales Region' }, 'closedAt'],
      // Reading the toggle inside the extractor, rather than rebuilding the rule, is what makes
      // it reactive without recreating the table (same shape as `grouping-when`'s predicates).
      schema: (path) =>
        applyGroupKey(path.closedAt, (date) =>
          this.bucketClosedAtByMonth() ? monthOf(date) : date
        ),
    })
  );

  protected readonly visibleColumns = computed(() =>
    this.table
      .columns()
      .filter((column) => column.visible)
      .sort((a, b) => a.order - b.order)
  );

  protected readonly groupedByTerritory = computed(() =>
    this.table.isGroupedBy(MISSING_GROUPING_LEVEL)
  );

  protected toggleTerritoryLevel(): void {
    if (this.groupedByTerritory()) {
      this.table.grouping.update(removeGroupLevel<DealRow>(MISSING_GROUPING_LEVEL));
      return;
    }
    this.table.grouping.update(addGroupLevel<DealRow>(MISSING_GROUPING_LEVEL));
  }

  protected isDateValue(value: unknown): value is Date {
    return value instanceof Date;
  }
}
