import { Component, computed, input, signal } from '@angular/core';
import {
  createTable,
  NgpTableDirective,
  NgpTableRowDirective,
  setGroupLevels,
  withFiltering,
  withGrouping,
  withSelection,
  type RenderRow,
  type RowId,
} from '../../../index';
import { GROUPING_ROWS_MOCK } from '../fixtures/mock';
import { dealFilters, groupingConfig, SELECTION_GROUPING_LEVELS } from '../fixtures/schema';
import type { DealRow } from '../fixtures/types';
import { readRepCriterion, repFilterNode } from '../fixtures/utils';
import { GROUPING_STORY_PIPES } from '../grouping-story.pipes';
import { GroupingSelectionToolbarComponent } from './grouping-selection-toolbar.component';
import type { CascadeMode } from './grouping-selection.types';

/**
 * Group selection, cascading checkboxes
 *
 * Ticking a group's checkbox cascades via a consumer-owned `cascade` function over `rowsOf()` —
 * the peer defaults are ordinary code, not library options. A group's tri-state derives fresh on
 * every render rather than being stored, which is also why cascading to *parents* needs no write
 * and is therefore not a mode.
 */
@Component({
  selector: 'ngp-grouping-selection-story-host',
  templateUrl: './grouping-selection-story-host.component.html',
  styleUrls: ['../../styles/story-host.css', '../grouping-story.css'],
  imports: [
    NgpTableDirective,
    NgpTableRowDirective,
    ...GROUPING_STORY_PIPES,
    GroupingSelectionToolbarComponent,
  ],
})
export class GroupingSelectionStoryHostComponent {
  readonly cascade = input<CascadeMode>('descendants');

  protected readonly data = signal<DealRow[]>(GROUPING_ROWS_MOCK);
  protected readonly table = createTable(
    this.data,
    groupingConfig,
    withGrouping({ initial: SELECTION_GROUPING_LEVELS }),
    withSelection(),
    withFiltering({ schema: dealFilters }),
  );

  protected readonly repFilter = computed(() => readRepCriterion(this.table.filters));

  protected readonly isGrouped = computed(() => this.table.grouping().length > 0);

  /** The denominator is rows the pipeline produced, never render rows, so a header can never be
   * counted as one of them. */
  protected readonly selectionReadout = computed(
    () => `${this.table.selectedRows().size} of ${this.table.rows().length} rows selected`,
  );

  /** Always 0, and rendered anyway: a group id ending up in the selection state is only ever
   * observable by looking. */
  protected readonly selectedGroupHeaderCount = computed(() => {
    const groupIds = new Set(
      this.table
        .renderRows()
        .filter((row) => row.kind === 'group')
        .map((row) => row.id),
    );
    return [...this.table.selectedRows()].filter((id) => groupIds.has(id)).length;
  });

  protected onFilterRep(value: string): void {
    repFilterNode(this.table.filters).value.set(value);
  }

  /**
   * Every group header's tri-state, resolved once per render. One record rather than two
   * per-row calls, so `rowsOf()` runs once per group instead of twice, and a checkbox reads a
   * value rather than asking a question.
   */
  protected readonly groupSelectionStateById = computed(() =>
    Object.fromEntries(
      this.table
        .renderRows()
        .filter((row) => row.kind === 'group')
        .map((row) => [row.id, this.table.selectionStateOf(this.groupRowIds(row))]),
    ),
  );

  /**
   * The whole cascade, in one function reading the arg signal. `self` writes nothing because there
   * is no group record to write; `descendants` writes the leaf set. The upward direction is
   * absent on purpose — an ancestor's tri-state is derived, so there is nothing to write.
   */
  protected onToggleGroupSelection(row: RenderRow<DealRow>): void {
    const shouldCascadeToDescendants = this.cascade() !== 'self';
    if (!shouldCascadeToDescendants) {
      return;
    }
    const ids = this.groupRowIds(row);
    if (this.table.selectionStateOf(ids) === 'all') {
      this.table.deselect(ids);
      return;
    }
    this.table.select(ids);
  }

  protected onToggleRowSelection(rowId: RowId): void {
    this.table.toggle(rowId);
  }

  protected clearSelection(): void {
    this.table.clearSelection();
  }

  /** Nothing to prune: ungrouping removes headers from `renderRows()` and the selection is
   * untouched, because no header id was ever in it. */
  protected toggleGrouping(): void {
    const nextLevels = this.isGrouped() ? [] : SELECTION_GROUPING_LEVELS;
    this.table.grouping.update(setGroupLevels<DealRow>(nextLevels));
  }

  /** Every row beneath the group at any depth — post-filter and collapse-independent, because
   * `rowsOf()` is re-derived from the pipeline's rows rather than scanned out of `renderRows()`. */
  private groupRowIds(row: RenderRow<DealRow>): RowId[] {
    return this.table.rowsOf(row).map((deal) => this.table.trackBy(deal));
  }
}
