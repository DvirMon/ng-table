import { Component, computed, input, linkedSignal, signal } from '@angular/core';
import { applyGrouping, createTable, withGrouping, type GroupKey } from '../../../index';
import { GROUPING_ROWS_MOCK } from '../fixtures/mock';
import { plainGroupingConfig, BASE_GROUPING_LEVELS } from '../fixtures/schema';
import type { DealRow } from '../fixtures/types';
import { GROUPING_STORY_PIPES } from '../grouping-story.pipes';
import { GroupingWhenToolbarComponent } from './grouping-when-toolbar.component';

/** Blank in the product sense, not the JS sense: `null`, `undefined` and `''` all read as "this
 * deal has no region". */
function isPresentKey(key: GroupKey): boolean {
  return key !== null && key !== undefined && key !== '';
}

/**
 * Cluster admission — `when`
 *
 * Two predicates, AND-combined. The table-wide `when` is judged at every active level; the
 * per-column one comes off an `applyGrouping` rule and judges its own column only.
 *
 * A rejected cluster is not hidden — its rows render flat at the parent's depth, with no header,
 * no group id and no aggregates. Rejecting at level 1 therefore takes those rows out of level 2
 * as well: they left the tree, so there is nothing left to sub-group.
 */
@Component({
  selector: 'ngp-grouping-when-story-host',
  templateUrl: './grouping-when-story-host.component.html',
  styleUrls: ['../../styles/story-host.css', '../grouping-story.css'],
  imports: [...GROUPING_STORY_PIPES, GroupingWhenToolbarComponent],
})
export class GroupingWhenStoryHostComponent {
  readonly showCount = input(true);
  readonly keepBlankRegionsFlat = input(false);
  readonly applyMinCategorySize = input(false);
  readonly minCategoryRowCount = input(2);

  /** Resets from the `minCategoryRowCount` arg but stays writable from the toolbar's own number
   * input — a story-canvas edit, not a Storybook Controls edit. */
  protected readonly minCategoryRowCountValue = linkedSignal(() => this.minCategoryRowCount());

  protected readonly data = signal<DealRow[]>(GROUPING_ROWS_MOCK);
  protected readonly table = createTable(
    this.data,
    plainGroupingConfig,
    withGrouping({
      initial: BASE_GROUPING_LEVELS,
      when: (cluster) => !this.keepBlankRegionsFlat() || isPresentKey(cluster.key),
      // A `when`-only rule: no `enable`, so it contributes no level activation — only a
      // predicate for 'category'. Reading the signals inside the predicate, rather than
      // rebuilding the rule, is what makes the toggle reactive.
      schema: (path) =>
        applyGrouping(path.category, {
          when: (cluster) =>
            !this.applyMinCategorySize() ||
            cluster.rows.length >= this.minCategoryRowCountValue(),
        }),
    })
  );

  protected readonly visibleColumns = computed(() =>
    this.table
      .columns()
      .filter((column) => column.visible)
      .sort((a, b) => a.order - b.order)
  );

  /** Rows the pipeline produced that no header claims — the flat runs a rejected cluster leaves
   * behind, counted so the opt-out is legible without counting rows by eye. */
  protected readonly flatRowCount = computed(
    () => this.table.renderRows().filter((row) => row.kind === 'row' && row.depth === 0).length
  );
}
